"""Prediction module for external power forecasting system.

This module loads the current production model and makes predictions on new input data.
"""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import yaml

from src.data.load_data import load_tabular_data, save_tabular_data, load_config, get_data_path
from src.data.clean_data import clean_power_data
from src.features.build_features import build_features, drop_feature_na_rows


class PredictionError(Exception):
    """Base exception for prediction errors."""
    pass


class NoProductionModelError(PredictionError):
    """Raised when no production model is available."""
    pass


def predict(
    data_path: str | None = None,
    output_path: str | None = None,
    data_config_path: str = "config/data_config.yaml",
    model_config_path: str = "config/model_config.yaml",
) -> dict[str, Any]:
    """Make predictions using the current production model.

    This function:
        1. Loads the current production model from registry
        2. Loads prediction input data
        3. Applies data cleaning and feature engineering
        4. Makes predictions
        5. Saves results to output file

    Args:
        data_path: Path to prediction input data. If None, uses config default.
        output_path: Path to save prediction results. If None, uses default path.
        data_config_path: Path to data configuration file.
        model_config_path: Path to model configuration file.

    Returns:
        Dictionary containing prediction results metadata.

    Raises:
        NoProductionModelError: If no production model exists.
        PredictionError: If prediction fails.
    """
    # Load configurations
    data_config = _load_yaml(data_config_path)
    model_config = _load_yaml(model_config_path)

    # Determine data paths
    if data_path is None:
        data_path = get_data_path(data_config, "prediction_input_path")
    if output_path is None:
        output_path = "outputs/reports/prediction_result.csv"

    print("=" * 60)
    print("外购电预测")
    print("=" * 60)

    # Step 1: Load production model
    print(f"\n[步骤 1/5] 加载生产模型...")
    from src.registry.model_registry import ModelRegistry

    registry = ModelRegistry(
        model_name="purchase_power",
        store_dir=model_config.get("registry", {}).get("model_store_dir", "model_store")
    )

    try:
        model_info = registry.get_production_model_info()
    except Exception as e:
        raise NoProductionModelError(
            "没有找到生产模型。请先训练模型并将其提升为生产状态。\n"
            "运行命令:\n"
            "  1. python -m src.models.train_model\n"
            "  2. python -m src.registry.model_registry promote <model_id>"
        ) from e

    print(f"  模型ID: {model_info['model_id']}")
    print(f"  模型名称: {model_info['model_name']}")
    print(f"  特征数量: {len(model_info['feature_list'])}")

    # Load model artifact
    model_artifact_path = model_info["artifact_path"]
    model_package = joblib.load(model_artifact_path)
    model = model_package["model"]
    # Get feature list from model package first, fallback to registry info
    feature_list = model_package.get("features", model_info.get("feature_list", []))
    if not feature_list:
        raise PredictionError("模型中未找到特征列表")

    # Step 2: Load prediction input data
    print(f"\n[步骤 2/5] 加载预测输入数据...")
    print(f"  数据路径: {data_path}")
    raw_df = load_tabular_data(data_path)
    print(f"  数据行数: {len(raw_df)}")

    # Get target date column
    datetime_col = data_config.get("datetime_col", "date")
    target_col = data_config.get("target_col", "purchase_power")

    # Step 3: Data cleaning
    print(f"\n[步骤 3/5] 数据清洗...")
    cleaned_df = clean_power_data(raw_df, data_config, training=False)
    print(f"  清洗后行数: {len(cleaned_df)}")

    # Step 4: Feature engineering (only generate date-based features, keep existing lag features)
    print(f"\n[步骤 4/5] 特征工程...")
    # Sort by date first
    feature_df = cleaned_df.sort_values(datetime_col).reset_index(drop=True)

    # Generate only date-based features, do not overwrite lag features
    feature_df["weekday"] = feature_df[datetime_col].dt.weekday
    feature_df["month"] = feature_df[datetime_col].dt.month
    feature_df["is_weekend"] = (feature_df["weekday"] >= 5).astype(int)

    print(f"  特征工程后行数: {len(feature_df)}")

    # Step 5: Make predictions
    print(f"\n[步骤 5/5] 生成预测...")

    # Check if we have valid feature rows
    if len(feature_df) == 0:
        raise PredictionError("特征工程后没有有效数据进行预测")

    # Validate all required features are present
    missing_features = [f for f in feature_list if f not in feature_df.columns]
    if missing_features:
        raise PredictionError(
            f"输入数据缺少模型所需的特征: {', '.join(missing_features)}. "
            f"请确保输入数据包含所有滞后特征 (purchase_lag_1, purchase_lag_7, purchase_rolling_7)。"
        )

    # Check for NaN values in features
    X_pred = feature_df[feature_list].copy()
    nan_mask = X_pred.isna().any(axis=1)
    if nan_mask.any():
        nan_rows = nan_mask[nan_mask].index.tolist()
        nan_features = X_pred.columns[X_pred.isna().any()].tolist()
        raise PredictionError(
            f"输入数据存在缺失值。行: {nan_rows[:5]} (共 {len(nan_rows)} 行), "
            f"缺失特征: {', '.join(nan_features)}. 请检查输入数据并补全所有特征值。"
        )

    print(f"  有效预测行数: {len(X_pred)}")

    # Make predictions
    predictions = model.predict(X_pred)

    # Create output DataFrame matching original row count
    output_df = raw_df.copy()
    output_column = "prediction_value"
    
    # Ensure prediction count matches input rows
    if len(predictions) != len(output_df):
        raise PredictionError(f"预测行数 ({len(predictions)}) 与输入行数 ({len(output_df)}) 不一致")
    
    output_df[output_column] = predictions

    # Add metadata columns
    predict_time = datetime.now().isoformat()
    output_df["model_name"] = model_info["model_name"]
    output_df["model_version"] = model_info["model_id"]
    output_df["algorithm"] = model_package.get("algorithm", model_info.get("algorithm"))
    output_df["predict_time"] = predict_time

    # Select and reorder output columns
    output_columns = [
        datetime_col,
        target_col,
        output_column,
        "model_name",
        "model_version",
        "algorithm",
        "predict_time",
    ]
    # Only include columns that exist
    output_columns = [col for col in output_columns if col in output_df.columns]
    output_df = output_df[output_columns]

    # Save predictions
    output_path_obj = Path(output_path)
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    save_tabular_data(output_df, output_path)

    print(f"\n" + "=" * 60)
    print("预测完成!")
    print("=" * 60)
    print(f"  预测样本数: {len(output_df)}")
    print(f"  结果保存路径: {output_path}")

    # Print sample predictions
    valid_preds = output_df[output_df[output_column].notna()]
    if len(valid_preds) > 0:
        print(f"\n  预测结果示例:")
        sample = valid_preds.head(min(5, len(valid_preds)))
        for _, row in sample.iterrows():
            date_val = row[datetime_col]
            pred_val = row[output_column]
            print(f"    {date_val}: {pred_val:.2f}")

    return {
        "model_id": model_info["model_id"],
        "model_name": model_info["model_name"],
        "predict_time": predict_time,
        "sample_count": len(valid_preds),
        "output_path": str(output_path),
    }


def _load_yaml(path: str) -> dict[str, Any]:
    """Load YAML configuration file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def main() -> None:
    """Command-line entry point for prediction."""
    parser = argparse.ArgumentParser(description="使用生产模型进行外购电预测")
    parser.add_argument(
        "--data",
        help="预测输入数据路径 (CSV/Excel). 如果不指定, 使用配置文件中的路径"
    )
    parser.add_argument(
        "--output",
        help="预测结果输出路径. 如果不指定, 保存到 outputs/reports/prediction_result.csv"
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

    args = parser.parse_args()

    try:
        result = predict(
            data_path=args.data,
            output_path=args.output,
            data_config_path=args.data_config,
            model_config_path=args.model_config,
        )
        print("\n[预测完成]")
        print(f"模型: {result['model_name']} ({result['model_id']})")
        print(f"预测时间: {result['predict_time']}")
        print(f"样本数: {result['sample_count']}")

    except NoProductionModelError as e:
        print(f"\n❌ 错误: {e}")
        exit(1)
    except PredictionError as e:
        print(f"\n❌ 预测失败: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ 未知错误: {e}")
        exit(1)


if __name__ == "__main__":
    main()
