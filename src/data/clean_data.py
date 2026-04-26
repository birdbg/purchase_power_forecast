"""Data cleaning utilities for external power forecasting system."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


def clean_power_data(df: pd.DataFrame, data_config: dict[str, Any], training: bool = True) -> pd.DataFrame:
    """Apply comprehensive cleaning rules for purchased power forecasting data.

    Cleaning steps (in order):
        1. Convert date column to datetime
        2. Sort by date
        3. Remove duplicate dates (keep last)
        4. Convert numeric fields to numeric type
        5. Handle missing values:
           - Drop rows with missing target (purchase_power)
           - Forward/backward fill other numeric fields
        6. Handle anomalies: negative values for power/output fields -> NaN -> fill

    Args:
        df: Input DataFrame to clean.
        data_config: Configuration dictionary with data processing settings.
        training: If True, applies training-specific cleaning (e.g., target validation).

    Returns:
        Cleaned DataFrame.
    """
    result = df.copy()

    # Get configuration values
    datetime_col = data_config.get("datetime_col", "date")
    target_col = data_config.get("target_col", "purchase_power")
    numeric_features = data_config.get("base_features", [])
    cleaning_config = data_config.get("cleaning", {})

    # Step 1: Convert date column to datetime
    if datetime_col in result.columns:
        result[datetime_col] = pd.to_datetime(result[datetime_col], errors="coerce")
        logger.info(f"Converted '{datetime_col}' to datetime")

    # Step 2: Sort by date
    result = result.sort_values(datetime_col).reset_index(drop=True)
    logger.info("Sorted data by date")

    # Step 3: Remove duplicate dates (keep last)
    initial_rows = len(result)
    result = result.drop_duplicates(subset=[datetime_col], keep="last")
    duplicates_removed = initial_rows - len(result)
    if duplicates_removed > 0:
        logger.warning(f"Removed {duplicates_removed} duplicate date rows")

    # Step 4: Convert numeric fields
    all_numeric_cols = numeric_features + [target_col]
    for col in all_numeric_cols:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce")

    # Step 6: Handle negative values as anomalies
    negative_value_cols = [
        "purchase_power",
        "total_power",
        "self_power",
        "steel_output",
        "rolling_output",
    ]
    for col in negative_value_cols:
        if col in result.columns:
            negative_mask = result[col] < 0
            negative_count = negative_mask.sum()
            if negative_count > 0:
                logger.warning(f"Found {negative_count} negative values in '{col}', setting to NaN")
                result.loc[negative_mask, col] = pd.NA

    # Step 5: Handle missing values
    if training and target_col in result.columns:
        missing_target = result[target_col].isna().sum()
        if missing_target > 0:
            logger.warning(f"Found {missing_target} rows with missing target, dropping them")
        result = result.dropna(subset=[target_col])

    # Forward/backward fill for other numeric features
    fill_strategy = cleaning_config.get("numeric_missing_strategy", "ffill")

    for col in numeric_features:
        if col in result.columns:
            missing_count = result[col].isna().sum()
            if missing_count > 0:
                logger.info(f"Filling {missing_count} missing values in '{col}' using '{fill_strategy}'")
                if fill_strategy == "ffill":
                    result[col] = result[col].ffill().bfill()
                elif fill_strategy == "bfill":
                    result[col] = result[col].bfill().ffill()
                elif fill_strategy == "median":
                    median_val = result[col].median()
                    result[col] = result[col].fillna(median_val)
                elif fill_strategy == "mean":
                    mean_val = result[col].mean()
                    result[col] = result[col].fillna(mean_val)
                else:
                    result[col] = result[col].ffill().bfill()

    # Reset index after cleaning
    result = result.reset_index(drop=True)

    logger.info(f"Cleaning complete. Final shape: {result.shape}")
    return result


def get_data_quality_report(df: pd.DataFrame, datetime_col: str = "date", target_col: str = "purchase_power") -> dict[str, Any]:
    """Generate a data quality report for the input DataFrame.

    The report includes:
        - Total row count
        - Date range (start and end)
        - Missing value statistics per column
        - Basic statistics (count, mean, std, min, max) per numeric column

    Args:
        df: Input DataFrame to analyze.
        datetime_col: Name of the date column. Default is 'date'.
        target_col: Name of the target column. Default is 'purchase_power'.

    Returns:
        Dictionary containing data quality metrics.
    """
    report: dict[str, Any] = {}

    # Basic info
    report["total_rows"] = len(df)
    report["total_columns"] = len(df.columns)

    # Date range
    if datetime_col in df.columns:
        dates = pd.to_datetime(df[datetime_col], errors="coerce")
        valid_dates = dates.dropna()
        if len(valid_dates) > 0:
            report["date_range"] = {
                "start": valid_dates.min().strftime("%Y-%m-%d"),
                "end": valid_dates.max().strftime("%Y-%m-%d"),
                "span_days": (valid_dates.max() - valid_dates.min()).days,
            }

    # Missing values per column
    missing_stats = {}
    for col in df.columns:
        missing_count = df[col].isna().sum()
        if missing_count > 0:
            missing_stats[col] = {
                "missing_count": int(missing_count),
                "missing_pct": round(missing_count / len(df) * 100, 2),
            }
    report["missing_values"] = missing_stats

    # Numeric statistics per column
    numeric_stats = {}
    numeric_cols = df.select_dtypes(include=["number"]).columns
    for col in numeric_cols:
        stats = df[col].describe()
        numeric_stats[col] = {
            "count": int(stats.get("count", 0)),
            "mean": round(stats.get("mean", 0), 2),
            "std": round(stats.get("std", 0), 2),
            "min": round(stats.get("min", 0), 2),
            "25%": round(stats.get("25%", 0), 2),
            "50%": round(stats.get("50%", 0), 2),
            "75%": round(stats.get("75%", 0), 2),
            "max": round(stats.get("max", 0), 2),
        }
    report["numeric_statistics"] = numeric_stats

    return report


def print_data_quality_report(df: pd.DataFrame, datetime_col: str = "date", target_col: str = "purchase_power") -> None:
    """Print a formatted data quality report to console.

    Args:
        df: Input DataFrame to analyze.
        datetime_col: Name of the date column. Default is 'date'.
        target_col: Name of the target column. Default is 'purchase_power'.
    """
    report = get_data_quality_report(df, datetime_col, target_col)

    print("=" * 60)
    print("数据质量报告 (Data Quality Report)")
    print("=" * 60)

    # Basic info
    print(f"\n【基本信息】")
    print(f"  总行数: {report['total_rows']}")
    print(f"  总列数: {report['total_columns']}")

    # Date range
    if "date_range" in report:
        print(f"\n【日期范围】")
        print(f"  开始日期: {report['date_range']['start']}")
        print(f"  结束日期: {report['date_range']['end']}")
        print(f"  跨度天数: {report['date_range']['span_days']} 天")

    # Missing values
    print(f"\n【缺失值统计】")
    missing = report.get("missing_values", {})
    if missing:
        for col, stats in missing.items():
            print(f"  {col}: {stats['missing_count']} ({stats['missing_pct']}%)")
    else:
        print("  无缺失值")

    # Numeric statistics
    print(f"\n【数值字段统计】")
    numeric_stats = report.get("numeric_statistics", {})
    for col, stats in numeric_stats.items():
        print(f"\n  [{col}]")
        print(f"    样本数: {stats['count']}")
        print(f"    均值: {stats['mean']}, 标准差: {stats['std']}")
        print(f"    范围: [{stats['min']}, {stats['max']}]")
        print(f"    分位数: 25%={stats['25%']}, 50%={stats['50%']}, 75%={stats['75%']}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    """Test entry point for data cleaning."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.data.load_data import load_tabular_data, load_config, get_data_path

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    print("=" * 60)
    print("Testing data cleaning functionality")
    print("=" * 60)

    # Load sample data
    config = load_config()
    raw_data_path = get_data_path(config, "raw_data_path")
    df = load_tabular_data(raw_data_path)

    print(f"\n[Original Data]")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")

    # Print original data quality
    print("\n--- 原始数据质量报告 ---")
    print_data_quality_report(df)

    # Clean data
    cleaned_df = clean_power_data(df, config, training=True)

    print(f"\n[Cleaned Data]")
    print(f"Shape: {cleaned_df.shape}")
    print(f"Columns: {list(cleaned_df.columns)}")

    # Print cleaned data quality
    print("\n--- 清洗后数据质量报告 ---")
    print_data_quality_report(cleaned_df)
