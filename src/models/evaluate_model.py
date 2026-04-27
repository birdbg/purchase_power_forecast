"""Model evaluation module for external power forecasting system.
This module evaluates model performance on test data and generates reports.
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
import joblib
import pandas as pd
import yaml
from src.data.load_data import load_tabular_data, load_config, get_data_path, DataLoadError
from src.data.clean_data import clean_power_data
from src.features.build_features import build_training_dataset
from src.utils.metrics import evaluate_regression, print_metrics
from src.registry.model_registry import ModelRegistry, ModelNotFoundError
class EvaluationError(Exception):
    """Base exception for evaluation errors."""
    pass
class NoProductionModelError(EvaluationError):
    """Raised when no production model is available."""
    pass
def evaluate_model(
    version: Optional[str] = None,
    data_path: Optional[str] = None,
    output_path: Optional[str] = None,
    data_config_path: str = "config/data_config.yaml",
    model_config_path: str = "config/model_config.yaml",
) -> dict[str, Any]:
    """Evaluate a model version on test data and generate evaluation report.
    Args:
        version: Model version to evaluate. If None, uses current production model.
        data_path: Path to evaluation data. If None, uses config default.
        output_path: Path to save evaluation report. If None, uses default path.
        data_config_path: Path to data configuration file.
        model_config_path: Path to model configuration file.
    Returns:
        Dictionary containing evaluation results.
    """
    # Load configurations
    data_config = _load_yaml(data_config_path)
    model_config = _load_yaml(model_config_path)
    # Determine data paths
    if data_path is None:
        data_path = get_data_path(data_config, "processed_data_path")
    # Step 1: Load model
    print("=" * 60)
    print("模型评估")
    print("=" * 60)
    print(f"\n[步骤 1/5] 加载模型...")
    registry = ModelRegistry(
        model_name="purchase_power",
        store_dir=model_config.get("registry", {}).get("model_store_dir", "model_store")
    )
    try:
        if version:
            model_info = registry.get_model_info(version)
            print(f"  评估模型版本: {version}")
        else:
            model_info = registry.get_production_model_info()
            print(f"  评估当前生产模型: {model_info['model_id']}")
    except ModelNotFoundError as e:
        raise NoProductionModelError(
            f"未找到模型版本 {version or 'production'}。\n"
            "请先训练模型并将其提升为生产状态。"
        ) from e
    except Exception as e:
        raise EvaluationError(f"加载模型失败: {str(e)}") from e
    # Load model artifact
    model_artifact_path = model_info["artifact_path"]
    model_data = joblib.load(model_artifact_path)
    model = model_data["model"]
    feature_list = model_data.get("features", model_info.get("feature_list", []))
    algorithm = model_data.get("algorithm", model_info.get("model_name", "unknown"))
    # Step 2: Load evaluation data
    print(f"\n[步骤 2/5] 加载评估数据...")
    print(f"  数据路径: {data_path}")
    try:
        raw_df = load_tabular_data(data_path)
    except (FileNotFoundError, DataLoadError):
        # Fallback to raw data if processed data not available or load failed
        raw_data_path = get_data_path(data_config, "raw_data_path")
        print(f"  处理后数据不存在或读取失败，改用原始数据重新清洗和特征工程: {raw_data_path}")
        raw_df = load_tabular_data(raw_data_path)
    print(f"  数据行数: {len(raw_df)}")
    # Step 3: Data cleaning and feature engineering
    print(f"\n[步骤 3/5] 数据清洗和特征工程...")
    cleaned_df = clean_power_data(raw_df, data_config, training=True)
    train_df = build_training_dataset(cleaned_df, data_config, model_config)
    target_col = model_config.get("target") or data_config.get("target_col", "purchase_power")
    # Prepare features and target
    X = train_df[feature_list].copy()
    y = train_df[target_col].copy()
    # Split train/test by time
    test_ratio = model_config.get("train_test_split_ratio", 0.2)
    split_index = int(len(X) * (1 - test_ratio))
    X_test = X.iloc[split_index:]
    y_test = y.iloc[split_index:]
    print(f"  测试集样本数: {len(X_test)}")
    # Step 4: Make predictions and evaluate
    print(f"\n[步骤 4/5] 模型评估...")
    if len(X_test) == 0:
        raise EvaluationError("测试集为空，无法评估")
    y_pred = model.predict(X_test)
    metrics = evaluate_regression(y_test, y_pred)
    print_metrics(metrics, "模型评估结果")
    
    # Generate sample records
    samples: list[dict[str, Any]] = []
    # Get date column if exists
    date_col = data_config.get("date_col", "date")
    for idx, (actual, predict) in enumerate(zip(y_test, y_pred)):
        # Get date from test set index or use placeholder
        if date_col in train_df.columns and idx < len(train_df.iloc[split_index:]):
            date_val = train_df.iloc[split_index + idx][date_col]
            if isinstance(date_val, pd.Timestamp):
                date_str = date_val.strftime("%Y-%m-%d")
            else:
                date_str = str(date_val)
        else:
            date_str = f"2025-01-{idx + 1:02d}"
        
        error = abs(predict - actual)
        error_rate = round(error / actual * 100, 2) if actual > 0 else 0
        
        # Determine status
        if error_rate >= 10:
            status = "abnormal"
        elif error_rate >= 5:
            status = "warning"
        else:
            status = "normal"
        
        samples.append({
          "id": f"eval_{idx}",
          "datetime": date_str,
          "predictValue": float(predict) if not isinstance(predict, float) else predict,
          "actualValue": float(actual) if not isinstance(actual, float) else actual,
          "error": float(error) if not isinstance(error, float) else error,
          "errorRate": float(error_rate) if not isinstance(error_rate, float) else error_rate,
          "modelVersion": model_info["model_id"],
          "status": status
        })
    
    # Step 5: Save evaluation report
    print(f"\n[步骤 5/5] 保存评估报告...")
    report = {
        "model_id": model_info["model_id"],
        "algorithm": algorithm,
        "evaluation_time": datetime.now().isoformat(),
        "test_sample_count": len(X_test),
        "metrics": metrics,
        "feature_count": len(feature_list),
        "features": feature_list,
        "data_path": str(data_path),
        "samples": samples,
    }
    if output_path is None:
        output_path = f"outputs/reports/evaluation_report_{model_info['model_id']}.json"
    output_path_obj = Path(output_path)
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    _write_json(output_path_obj, report)
    print(f"  报告已保存到: {output_path}")
    print(f"\n" + "=" * 60)
    print("评估完成!")
    print("=" * 60)
    return report
def _load_yaml(path: str) -> dict[str, Any]:
    """Load YAML configuration file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
def _write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write dictionary to JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
def main() -> None:
    """Command-line entry point for model evaluation."""
    import yaml
    import pandas as pd
    parser = argparse.ArgumentParser(description="评估外购电预测模型")
    parser.add_argument(
        "--version",
        help="要评估的模型版本. 如果不指定, 评估当前生产模型"
    )
    parser.add_argument(
        "--data",
        help="评估数据路径 (CSV/Excel). 如果不指定, 使用配置文件中的路径"
    )
    parser.add_argument(
        "--output",
        help="评估报告输出路径. 如果不指定, 保存到 outputs/reports/evaluation_report_<version>.json"
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
        result = evaluate_model(
            version=args.version,
            data_path=args.data,
            output_path=args.output,
            data_config_path=args.data_config,
            model_config_path=args.model_config,
        )
        print(f"\n[评估完成]")
        print(f"模型: {result['algorithm']} ({result['model_id']})")
        print(f"MAPE: {result['metrics']['mape']:.2f}%")
        print(f"RMSE: {result['metrics']['rmse']:.2f}")
        print(f"R2: {result['metrics']['r2']:.4f}")
    except NoProductionModelError as e:
        print(f"\n❌ 错误: {e}")
        exit(1)
    except EvaluationError as e:
        print(f"\n❌ 评估失败: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ 未知错误: {e}")
        exit(1)
if __name__ == "__main__":
    main()
