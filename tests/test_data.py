"""Tests for data loading and cleaning modules."""

from __future__ import annotations

import pytest
import pandas as pd
from pathlib import Path

from src.data.load_data import load_tabular_data, load_config, get_data_path
from src.data.clean_data import clean_power_data


class TestDataLoading:
    """Test cases for data loading functionality."""

    def test_load_csv_file(self, sample_data_path):
        """Test loading a CSV file."""
        df = load_tabular_data(sample_data_path)
        assert isinstance(df, pd.DataFrame)
        assert len(df) > 0

    def test_load_nonexistent_file_raises_error(self):
        """Test that loading a nonexistent file raises an error."""
        with pytest.raises(Exception):
            load_tabular_data("nonexistent_file.csv")

    def test_load_config(self, data_config_path):
        """Test loading YAML configuration."""
        config = load_config(data_config_path)
        assert isinstance(config, dict)
        assert "datetime_col" in config
        assert "target_col" in config

    def test_get_data_path(self, data_config_path):
        """Test getting data path from config."""
        config = load_config(data_config_path)
        path = get_data_path(config, "raw_data_path")
        assert isinstance(path, Path)


class TestDataCleaning:
    """Test cases for data cleaning functionality."""

    def test_clean_power_data(self, sample_data_path, data_config_path):
        """Test that data cleaning works correctly."""
        df = load_tabular_data(sample_data_path)
        config = load_config(data_config_path)
        cleaned_df = clean_power_data(df, config, training=True)

        # Verify date is converted to datetime
        assert pd.api.types.is_datetime64_any_dtype(cleaned_df["date"])

        # Verify no duplicate dates
        assert cleaned_df["date"].duplicated().sum() == 0

    def test_clean_removes_missing_target(self, sample_data_path, data_config_path):
        """Test that rows with missing target are removed during training."""
        df = load_tabular_data(sample_data_path)
        config = load_config(data_config_path)
        cleaned_df = clean_power_data(df, config, training=True)

        # Verify no missing target values
        target_col = config.get("target_col", "purchase_power")
        assert cleaned_df[target_col].isna().sum() == 0
