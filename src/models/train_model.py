"""Model training module for external power forecasting system."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
import pandas as pd

# Import data processing modules
from src.data.load_data import load_tabular_data, load_config, get_data_path
from src.data.clean_data import clean_power_data, print_data_quality_report

# Import feature engineering modules
from src.features.build_features import (
    build_training_dataset,
    get_feature_columns,
    drop_feature_na_rows,
)

# Import metrics
from src.utils.metrics import evaluate_regression, print_metrics

# Import registry
from src.registry.model_registry import register_candidate_model


def train_model(
    data_path: str | None = None,
    data_config_path: str = "config/data_config.yaml",
    model_config_path: str = "config/model_config.yaml",
    model_name: str | None = None,
    train_data_start: str | None = None,
    train_data_end: str | None = None,
    save_splits: bool = True,
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Train a purchased power forecasting model and register it as candidate.

    Training pipeline:
        1. Load configurations
        2. Load raw data
        3. Clean data
        4. Build features and training dataset
        5. Split train/test by time order (no shuffle)
        6. Train selected model (xgboost/lightgbm/random_forest)
        7. Evaluate on test set
        8. Register model as candidate
        9. Save model artifact and metadata

    Args:
        data_path: Path to training data. If None, uses config default.
        data_config_path: Path to data configuration file.
        model_config_path: Path to model configuration file.
        model_name: Model algorithm to use. If None, uses config default.

    Returns:
        Dictionary containing model_id, metrics, and artifact_path.
    """
    # Load configurations
    data_config = _load_yaml(data_config_path)
    model_config = _load_yaml(model_config_path)

    # Determine data path
    if data_path is None:
        data_path = get_data_path(data_config, "raw_data_path")

    print("=" * 60)
    print("外购电预测模型训练")
    print("=" * 60)
    print(f"\n[配置信息]")
    print(f"  数据路径: {data_path}")
    print(f"  算法: {model_name or model_config.get('algorithm', 'xgboost')}")

    # Load raw data
    print(f"\n[步骤 1/6] 加载原始数据...")
    raw_df = load_tabular_data(data_path)
    print(f"  原始数据: {raw_df.shape[0]} 行, {raw_df.shape[1]} 列")
    
    # Convert date column to datetime type
    datetime_col = data_config.get("datetime_col", "date")
    raw_df[datetime_col] = pd.to_datetime(raw_df[datetime_col])
    
    # Filter by date range if provided
    actual_train_start = raw_df[datetime_col].min().isoformat()
    actual_train_end = raw_df[datetime_col].max().isoformat()
    
    if train_data_start:
        raw_df = raw_df[raw_df[datetime_col] >= pd.to_datetime(train_data_start)]
    if train_data_end:
        raw_df = raw_df[raw_df[datetime_col] <= pd.to_datetime(train_data_end)]
    
    # Check if filtered data is empty
    if len(raw_df) == 0:
        raise ValueError("No training data found in selected date range")
    
    # Warn if data is too small
    if len(raw_df) < 30:
        import warnings
        warnings.warn(f"Training dataset only has {len(raw_df)} rows, which may lead to poor model performance")
    
    # Update to actual filtered date range
    actual_train_start = raw_df[datetime_col].min().isoformat()
    actual_train_end = raw_df[datetime_col].max().isoformat()
    print(f"  过滤后数据: {raw_df.shape[0]} 行, 日期范围: {actual_train_start} 至 {actual_train_end}")

    # Clean data
    print(f"\n[步骤 2/6] 清洗数据...")
    cleaned_df = clean_power_data(raw_df, data_config, training=True)
    print(f"  清洗后数据: {cleaned_df.shape[0]} 行")

    # Build training dataset with features
    print(f"\n[步骤 3/6] 构建特征...")
    train_df = build_training_dataset(cleaned_df, data_config, model_config)
    print(f"  训练数据集: {train_df.shape[0]} 行, {train_df.shape[1]} 列")

    # Prepare features and target
    target_col = model_config.get("target") or data_config.get("target_col", "purchase_power")
    datetime_col = data_config.get("datetime_col", "date")
    feature_info = get_feature_columns(data_config, model_config)
    feature_cols = feature_info["numeric"]

    # Extract X and y
    X = train_df[feature_cols].copy()
    y = train_df[target_col].copy()

    print(f"\n[步骤 4/6] 划分训练集/测试集...")
    X_train, X_test, y_train, y_test, split_index = _split_by_time(X, y, model_config)
    print(f"  训练集: {len(X_train)} 样本")
    print(f"  测试集: {len(X_test)} 样本")
    
    # Save split datasets if enabled
    train_df_split = None
    test_df_split = None
    if save_splits:
        from pathlib import Path
        datasets_dir = Path("outputs/datasets")
        datasets_dir.mkdir(parents=True, exist_ok=True)
        
        # Split the full train_df (includes date, target, features)
        train_df_split = train_df.iloc[:split_index]
        test_df_split = train_df.iloc[split_index:]
        
        # Save full features dataset
        feature_path = datasets_dir / f"{model_id}_features.csv"
        train_df.to_csv(feature_path, index=False, date_format="%Y-%m-%d")
        print(f"  特征数据集已保存: {feature_path}")
        
        # Save train split
        train_path = datasets_dir / f"{model_id}_train.csv"
        train_df_split.to_csv(train_path, index=False, date_format="%Y-%m-%d")
        print(f"  训练集已保存: {train_path}")
        
        # Save test split
        test_path = datasets_dir / f"{model_id}_test.csv"
        test_df_split.to_csv(test_path, index=False, date_format="%Y-%m-%d")
        print(f"  测试集已保存: {test_path}")

    # Train model
    print(f"\n[步骤 5/6] 训练模型...")
    model = _create_model(model_config, model_name)
    model.fit(X_train, y_train)
    print(f"  模型训练完成")

    # Evaluate on test set
    print(f"\n[步骤 6/6] 评估模型...")
    y_pred = model.predict(X_test)
    metrics = evaluate_regression(y_test, y_pred)
    print_metrics(metrics, "测试集评估结果")

    # Generate model version
    selected_model = model_name or model_config.get("algorithm", "xgboost")
    config_model_name = model_config.get("model_name", "purchase_power")
    model_id = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Create model directory
    model_store_dir = Path(model_config.get("registry", {}).get("model_store_dir", "model_store"))
    model_store_dir.mkdir(parents=True, exist_ok=True)
    model_dir = model_store_dir / model_id
    model_dir.mkdir(parents=True, exist_ok=True)

    # Save model artifact using joblib
    import joblib
    artifact_path = model_dir / "model.joblib"
    created_at = datetime.now().isoformat()
    
    # Get model parameters
    if selected_model == "random_forest":
        params = model_config.get("random_forest_params", {})
    elif selected_model == "xgboost":
        params = model_config.get("xgboost_params", {})
    elif selected_model == "lightgbm":
        params = model_config.get("lightgbm_params", {})
    else:
        params = {}
    
    # Save model in standard format
    model_package = {
        "model": model,
        "features": feature_cols,
        "algorithm": selected_model,
        "params": params,
        "metrics": metrics,
        "target": target_col,
        "created_at": created_at,
    }
    
    joblib.dump(model_package, artifact_path)

    metadata = {
        "model_id": model_id,
        "model_name": config_model_name,
        "algorithm": selected_model,
        "params": params,
        "target": target_col,
        "features": feature_cols,
        "metrics": metrics,
        "train_data_start": actual_train_start,
        "train_data_end": actual_train_end,
        "created_at": created_at,
        "data_path": str(data_path),
        "status": model_config.get("registry", {}).get("candidate_status", "candidate"),
        "split_ratio": model_config.get("train_test_split_ratio", 0.2),
        "train_sample_count": len(train_df_split) if train_df_split is not None else len(X_train),
        "test_sample_count": len(test_df_split) if test_df_split is not None else len(X_test),
    }
    
    # Add split file paths if saved
    if save_splits:
        datasets_dir = Path("outputs/datasets")
        metadata.update({
            "feature_dataset_path": str(datasets_dir / f"{model_id}_features.csv"),
            "train_dataset_path": str(datasets_dir / f"{model_id}_train.csv"),
            "test_dataset_path": str(datasets_dir / f"{model_id}_test.csv"),
        })
    if extra_metadata:
        metadata.update(extra_metadata)

    # Save metadata JSON
    metadata_path = model_dir / "metadata.json"
    _write_json(metadata_path, metadata)

    # Register model
    register_candidate_model(
        model_config=model_config,
        model_id=model_id,
        model_name=config_model_name,
        artifact_path=str(artifact_path),
        metadata_path=str(metadata_path),
        metrics=metrics,
    )

    # Save metrics to reports
    reports_dir = Path("outputs/reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    _write_json(reports_dir / f"{model_id}_metrics.json", metrics)

    print(f"\n" + "=" * 60)
    print("训练完成!")
    print("=" * 60)
    print(f"  模型ID: {model_id}")
    print(f"  模型状态: candidate")
    print(f"  模型保存路径: {artifact_path}")
    print(f"  元数据保存路径: {metadata_path}")

    return {
        "model_id": model_id,
        "metrics": metrics,
        "artifact_path": str(artifact_path),
    }


def _split_by_time(
    X: Any,
    y: Any,
    model_config: dict[str, Any],
) -> tuple[Any, Any, Any, Any, int]:
    """Split data by time order (no shuffle).

    Args:
        X: Feature DataFrame.
        y: Target Series.
        model_config: Model configuration.

    Returns:
        Tuple of (X_train, X_test, y_train, y_test, split_index).
    """
    test_ratio = model_config.get("train_test_split_ratio", 0.2)

    split_index = int(len(X) * (1 - test_ratio))
    if split_index < 1:
        split_index = 1
    if split_index >= len(X):
        split_index = len(X) - 1

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]
    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    return X_train, X_test, y_train, y_test, split_index


def _create_model(model_config: dict[str, Any], model_name: str | None = None) -> Any:
    """Create a model instance based on model configuration.

    Args:
        model_config: Model configuration dictionary.
        model_name: Model algorithm name. If None, uses config default.

    Returns:
        Trained model instance.
    """
    selected_model = model_name or model_config.get("algorithm", "xgboost")
    random_state = model_config.get("random_state", 42)

    if selected_model == "random_forest":
        from sklearn.ensemble import RandomForestRegressor

        params = model_config.get("random_forest_params", {})
        params.setdefault("random_state", random_state)
        return RandomForestRegressor(**params)

    elif selected_model == "xgboost":
        try:
            from xgboost import XGBRegressor
        except ImportError:
            print("错误: xgboost 未安装")
            print("请运行: pip install xgboost")
            sys.exit(1)

        params = model_config.get("xgboost_params", {})
        params.setdefault("random_state", random_state)
        return XGBRegressor(**params)

    elif selected_model == "lightgbm":
        try:
            from lightgbm import LGBMRegressor
        except ImportError:
            print("错误: lightgbm 未安装")
            print("请运行: pip install lightgbm")
            sys.exit(1)

        params = model_config.get("lightgbm_params", {})
        params.setdefault("random_state", random_state)
        return LGBMRegressor(**params)

    else:
        raise ValueError(f"不支持的模型算法: {selected_model}")


def _load_yaml(path: str) -> dict[str, Any]:
    """Load YAML configuration file.

    Args:
        path: Path to YAML file.

    Returns:
        Configuration dictionary.
    """
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write dictionary to JSON file.

    Args:
        path: Output file path.
        payload: Dictionary to save.
    """
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def main() -> None:
    """Command-line entry point for model training."""
    parser = argparse.ArgumentParser(description="训练外购电预测模型")
    parser.add_argument(
        "--data",
        help="原始数据路径 (CSV/Excel). 如果不指定, 使用配置文件中的路径"
    )
    parser.add_argument(
        "--data-config",
        default="config/data_config.yaml",
        help="数据配置文件路径"
    )
    parser.add_argument(
        "--model-config",
        default="config/model_config.yaml",
        help="模型配置文件路径"
    )
    parser.add_argument(
        "--model",
        choices=["xgboost", "lightgbm", "random_forest"],
        help="模型算法 (如果不指定, 使用配置文件中的默认值)"
    )

    args = parser.parse_args()

    result = train_model(
        data_path=args.data,
        data_config_path=args.data_config,
        model_config_path=args.model_config,
        model_name=args.model,
        train_data_start=None,
        train_data_end=None,
        save_splits=True,
    )

    print("\n[最终结果]")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
