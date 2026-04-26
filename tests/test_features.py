"""Tests for feature engineering module."""

from __future__ import annotations

import pytest
import pandas as pd
import numpy as np

from src.features.build_features import (
    build_features,
    build_training_dataset,
    get_feature_columns,
    drop_feature_na_rows,
    DATE_FEATURES,
    BUSINESS_FEATURES,
    TARGET_LAG_FEATURES,
    TARGET_ROLLING_FEATURES,
)


class TestFeatureEngineering:
    """Test cases for feature engineering functionality."""

    @pytest.fixture
    def sample_df(self, sample_data_path, data_config_path):
        """Create a sample DataFrame for testing."""
        from src.data.load_data import load_tabular_data, load_config
        from src.data.clean_data import clean_power_data

        df = load_tabular_data(sample_data_path)
        config = load_config(data_config_path)
        cleaned_df = clean_power_data(df, config, training=True)
        return cleaned_df, config

    def test_date_features_generated(self, sample_df):
        """Test that weekday, month, is_weekend are generated."""
        df, config = sample_df
        datetime_col = config.get("datetime_col", "date")

        # Sort by date first (required for feature engineering)
        df = df.sort_values(datetime_col).reset_index(drop=True)

        # Build features
        feature_df = build_features(df, config)

        # Check date features exist
        for feat in DATE_FEATURES:
            assert feat in feature_df.columns, f"Missing feature: {feat}"

        # Verify weekday values are in valid range (0-6)
        assert feature_df["weekday"].min() >= 0
        assert feature_df["weekday"].max() <= 6

        # Verify month values are in valid range (1-12)
        assert feature_df["month"].min() >= 1
        assert feature_df["month"].max() <= 12

        # Verify is_weekend values are 0 or 1
        assert set(feature_df["is_weekend"].unique()).issubset({0, 1})

    def test_lag_features_generated(self, sample_df):
        """Test that purchase_lag_1 and purchase_lag_7 are generated."""
        df, config = sample_df
        datetime_col = config.get("datetime_col", "date")

        # Sort by date first (required for lag features)
        df = df.sort_values(datetime_col).reset_index(drop=True)

        # Build features
        feature_df = build_features(df, config)

        # Check lag features exist
        assert "purchase_lag_1" in feature_df.columns
        assert "purchase_lag_7" in feature_df.columns

        # Verify lag_1 is the previous day's purchase_power
        # First row should be NaN (no previous day)
        assert pd.isna(feature_df["purchase_lag_1"].iloc[0])

    def test_rolling_features_generated(self, sample_df):
        """Test that purchase_rolling_7 is generated."""
        df, config = sample_df
        datetime_col = config.get("datetime_col", "date")

        # Sort by date first
        df = df.sort_values(datetime_col).reset_index(drop=True)

        # Build features
        feature_df = build_features(df, config)

        # Check rolling feature exists
        assert "purchase_rolling_7" in feature_df.columns

    def test_drop_feature_na_rows(self, sample_df):
        """Test that rows with NaN from lag features are dropped."""
        df, config = sample_df
        datetime_col = config.get("datetime_col", "date")

        # Sort by date first
        df = df.sort_values(datetime_col).reset_index(drop=True)

        # Build features
        feature_df = build_features(df, config)

        # Count NaN rows before drop
        nan_before = feature_df["purchase_lag_1"].isna().sum()

        # Drop NaN rows
        result_df = drop_feature_na_rows(feature_df)

        # Verify some rows were dropped
        assert len(result_df) < len(feature_df)
        assert nan_before > 0  # Should have had some NaN rows

        # Verify no NaN in lag features after drop
        assert result_df["purchase_lag_1"].isna().sum() == 0
        assert result_df["purchase_lag_7"].isna().sum() == 0

    def test_build_training_dataset(self, sample_df):
        """Test building a complete training dataset."""
        df, config = sample_df

        # Build training dataset
        train_df = build_training_dataset(df, config)

        # Verify expected features are present
        for feat in BUSINESS_FEATURES:
            if feat in df.columns:
                assert feat in train_df.columns

        for feat in DATE_FEATURES:
            assert feat in train_df.columns

        # Verify lag features are present (after drop_feature_na_rows)
        for feat in TARGET_LAG_FEATURES:
            assert feat in train_df.columns

        # Verify no duplicate dates
        datetime_col = config.get("datetime_col", "date")
        assert train_df[datetime_col].duplicated().sum() == 0

    def test_get_feature_columns(self, data_config_path):
        """Test getting feature column list."""
        from src.data.load_data import load_config

        config = load_config(data_config_path)
        features = get_feature_columns(config)

        assert "numeric" in features
        assert isinstance(features["numeric"], list)
        assert len(features["numeric"]) > 0
