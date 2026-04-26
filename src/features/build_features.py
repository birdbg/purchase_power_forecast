"""Feature engineering utilities for external power forecasting system."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# Default date-based features
DATE_FEATURES = ["weekday", "month", "is_weekend"]

# Default lag and rolling features for target variable
TARGET_LAG_FEATURES = ["purchase_lag_1", "purchase_lag_7"]
TARGET_ROLLING_FEATURES = ["purchase_rolling_7", "purchase_rolling_30"]

# Original business fields to preserve
BUSINESS_FEATURES = [
    "total_power",
    "self_power",
    "steel_output",
    "rolling_output",
    "temperature",
    "is_holiday",
    "is_maintenance",
]


def build_features(
    df: pd.DataFrame,
    data_config: dict[str, Any],
    model_config: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """Build features for both training and prediction.

    Feature categories:
        1. Date-based features: weekday, month, is_weekend
        2. Target lag features: purchase_lag_1, purchase_lag_7
        3. Target rolling features: purchase_rolling_7, purchase_rolling_30
        4. Original business fields: preserved as-is

    IMPORTANT: Lag and rolling features use only past data (no data leakage).
    The DataFrame must be sorted by date before calling this function.

    Args:
        df: Input DataFrame (should be cleaned and sorted by date).
        data_config: Configuration dictionary with data settings.
        model_config: Optional model config to filter features.

    Returns:
        DataFrame with newly engineered features added.
    """
    result = df.copy()

    # Get configuration
    datetime_col = data_config.get("datetime_col", "date")
    target_col = data_config.get("target_col", "purchase_power")
    selected_features = set((model_config or {}).get("features", []) or [])

    # Step 1: Date-based features
    if datetime_col in result.columns:
        date_values = pd.to_datetime(result[datetime_col], errors="coerce")

        # weekday: 0=Monday, 6=Sunday
        if not selected_features or "weekday" in selected_features:
            result["weekday"] = date_values.dt.dayofweek

        # month: 1-12
        if not selected_features or "month" in selected_features:
            result["month"] = date_values.dt.month

        # is_weekend: 1 if Saturday/Sunday, 0 otherwise
        if not selected_features or "is_weekend" in selected_features:
            result["is_weekend"] = (date_values.dt.dayofweek >= 5).astype(int)

        logger.info(f"Generated date-based features: {DATE_FEATURES}")

    # Step 2: Target lag features (only when target is available)
    # These features intentionally use .shift() which only looks at past data
    if target_col in result.columns:
        target_series = result[target_col]

        # Lag 1: yesterday's purchase_power
        if not selected_features or "purchase_lag_1" in selected_features:
            result["purchase_lag_1"] = target_series.shift(1)
            logger.info("Generated purchase_lag_1")

        # Lag 7: purchase_power from 7 days ago
        if not selected_features or "purchase_lag_7" in selected_features:
            result["purchase_lag_7"] = target_series.shift(7)
            logger.info("Generated purchase_lag_7")

    # Step 3: Target rolling features
    # Rolling mean is calculated after shift, ensuring only historical data is used
    if target_col in result.columns:
        target_series = result[target_col]

        # 7-day rolling mean (using shift(1) to exclude current day)
        if not selected_features or "purchase_rolling_7" in selected_features:
            result["purchase_rolling_7"] = target_series.shift(1).rolling(window=7, min_periods=1).mean()
            logger.info("Generated purchase_rolling_7")

        # 30-day rolling mean (using shift(1) to exclude current day)
        if not selected_features or "purchase_rolling_30" in selected_features:
            result["purchase_rolling_30"] = target_series.shift(1).rolling(window=30, min_periods=1).mean()
            logger.info("Generated purchase_rolling_30")

    # Step 4: Business features are preserved as-is
    preserved_count = len([f for f in BUSINESS_FEATURES if f in result.columns])
    logger.info(f"Preserved {preserved_count} business features")

    return result


def drop_feature_na_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows with NaN values caused by lag/rolling feature generation.

    Lag and rolling features produce NaN in the first few rows (e.g., lag_7
    produces NaN for the first 7 rows). This function removes those rows.

    Args:
        df: Input DataFrame with potential NaN values from feature engineering.

    Returns:
        DataFrame with NaN rows removed.
    """
    initial_rows = len(df)

    # Identify columns that may have NaN from lag/rolling operations
    lag_rolling_cols = [
        "purchase_lag_1",
        "purchase_lag_7",
        "purchase_rolling_7",
        "purchase_rolling_30",
    ]

    # Find which of these columns exist in the DataFrame
    existing_lag_cols = [col for col in lag_rolling_cols if col in df.columns]

    if existing_lag_cols:
        # Drop rows where any lag/rolling feature is NaN
        result = df.dropna(subset=existing_lag_cols)
        rows_dropped = initial_rows - len(result)

        if rows_dropped > 0:
            logger.info(f"Dropped {rows_dropped} rows with NaN from lag/rolling features")
    else:
        result = df

    return result.reset_index(drop=True)


def build_training_dataset(
    df: pd.DataFrame,
    data_config: dict[str, Any],
    model_config: dict[str, Any] | None = None,
    save_path: str | Path | None = None,
) -> pd.DataFrame:
    """Build a complete training dataset with all features.

    This function orchestrates the full feature engineering pipeline:
        1. Ensure data is sorted by date
        2. Build all features
        3. Drop rows with NaN from lag/rolling features
        4. Optionally save to CSV

    Args:
        df: Input DataFrame (cleaned historical data).
        data_config: Configuration dictionary.
        model_config: Optional model configuration.
        save_path: Optional path to save the training dataset.

    Returns:
        Ready-to-use training DataFrame.
    """
    datetime_col = data_config.get("datetime_col", "date")
    target_col = data_config.get("target_col", "purchase_power")

    # Ensure data is sorted by date (critical for lag features)
    result = df.sort_values(datetime_col).reset_index(drop=True)
    logger.info(f"Data sorted by '{datetime_col}' before feature engineering")

    # Build all features
    result = build_features(result, data_config, model_config)

    # Drop rows with NaN from lag/rolling features
    result = drop_feature_na_rows(result)

    # Select final columns (target + all features)
    feature_cols = _get_all_feature_columns(data_config, model_config)
    final_columns = [datetime_col, target_col] + feature_cols

    # Keep only columns that exist
    final_columns = [col for col in final_columns if col in result.columns]
    result = result[final_columns]

    logger.info(f"Training dataset built. Shape: {result.shape}")

    # Optionally save to CSV
    if save_path:
        output_path = Path(save_path).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result.to_csv(output_path, index=False, date_format="%Y-%m-%d")
        logger.info(f"Training dataset saved to: {output_path}")

    return result


def _get_all_feature_columns(
    data_config: dict[str, Any],
    model_config: dict[str, Any] | None = None,
) -> list[str]:
    """Get the complete list of feature columns.

    Args:
        data_config: Configuration dictionary.
        model_config: Optional model configuration.

    Returns:
        List of feature column names.
    """
    selected_features = (model_config or {}).get("features", [])

    if selected_features:
        return list(selected_features)

    # Fall back to default features
    features = []
    features.extend(BUSINESS_FEATURES)
    features.extend(DATE_FEATURES)
    features.extend(TARGET_LAG_FEATURES)
    features.extend(TARGET_ROLLING_FEATURES)

    return features


def get_feature_columns(
    data_config: dict[str, Any],
    model_config: dict[str, Any] | None = None,
) -> dict[str, list[str]]:
    """Return model feature columns grouped by type.

    Args:
        data_config: Configuration dictionary.
        model_config: Optional model configuration.

    Returns:
        Dictionary with 'numeric' and 'categorical' feature lists.
    """
    configured_features = list((model_config or {}).get("features", []) or [])

    if configured_features:
        return {
            "numeric": _deduplicate(configured_features),
            "categorical": [],
        }

    # Default feature set
    numeric_features = list(BUSINESS_FEATURES)
    numeric_features.extend(DATE_FEATURES)
    numeric_features.extend(TARGET_LAG_FEATURES)
    numeric_features.extend(TARGET_ROLLING_FEATURES)

    return {
        "numeric": _deduplicate(numeric_features),
        "categorical": [],
    }


def _deduplicate(values: list[str]) -> list[str]:
    """Remove duplicates while preserving order.

    Args:
        values: List of strings with potential duplicates.

    Returns:
        Deduplicated list preserving original order.
    """
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            result.append(value)
            seen.add(value)
    return result


if __name__ == "__main__":
    """Test entry point for feature engineering."""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.data.load_data import load_tabular_data, load_config, get_data_path
    from src.data.clean_data import clean_power_data, print_data_quality_report

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    print("=" * 60)
    print("Testing feature engineering functionality")
    print("=" * 60)

    # Load and clean data
    config = load_config()
    raw_data_path = get_data_path(config, "raw_data_path")
    df = load_tabular_data(raw_data_path)
    cleaned_df = clean_power_data(df, config, training=True)

    print(f"\n[Cleaned Data] Shape: {cleaned_df.shape}")

    # Build training dataset
    processed_data_path = Path(config.get("processed_data_path", "data/processed/processed_history.csv"))
    train_df = build_training_dataset(
        cleaned_df,
        config,
        save_path=processed_data_path,
    )

    print(f"\n[Training Dataset] Shape: {train_df.shape}")
    print(f"Columns: {list(train_df.columns)}")

    # Print sample data
    print(f"\nFirst 10 rows:")
    print(train_df.head(10).to_string())

    # Print data quality report
    print("\n--- 特征工程后数据质量报告 ---")
    print_data_quality_report(train_df)

    # Show feature info
    feature_info = get_feature_columns(config)
    print(f"\n[Feature Info]")
    print(f"  Numeric features ({len(feature_info['numeric'])}): {feature_info['numeric']}")
    print(f"  Categorical features ({len(feature_info['categorical'])}): {feature_info['categorical']}")
