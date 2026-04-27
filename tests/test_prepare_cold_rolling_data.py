#!/usr/bin/env python3
"""Test script for Cold Rolling data preparation module."""
import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from scripts.prepare_cold_rolling_data import (
    normalize_column_names,
    convert_is_holiday,
    convert_is_maintenance,
)

def test_normalize_column_names():
    """Test column name normalization from Chinese to English."""
    df = pd.DataFrame({
        "日期": ["2024-01-01", "2024-01-02"],
        "是否节假日": [1, 0],
        "是否检修": [0, 1],
        "检修时长": [0, 8],
        "计划产量": [1000, 1200],
        "实际产量": [980, 1180],
        "耗电量": [500, 520],
        "外购电量": [300, 310]
    })
    
    normalized = normalize_column_names(df)
    expected_columns = ["date", "is_holiday", "is_maintenance", "downtime_hours",
                       "planned_output", "actual_output", "power_consumption", "purchase_power"]
    
    assert all(col in normalized.columns for col in expected_columns)
    assert len(normalized.columns) == 8

def test_convert_is_holiday():
    """Test is_holiday conversion to 0/1."""
    assert convert_is_holiday(1) == 1
    assert convert_is_holiday("1") == 1
    assert convert_is_holiday("是") == 1
    assert convert_is_holiday(True) == 1
    assert convert_is_holiday("True") == 1
    assert convert_is_holiday("yes") == 1
    assert convert_is_holiday("Y") == 1
    
    assert convert_is_holiday(0) == 0
    assert convert_is_holiday("0") == 0
    assert convert_is_holiday("否") == 0
    assert convert_is_holiday(False) == 0
    assert convert_is_holiday("False") == 0
    assert convert_is_holiday("no") == 0
    assert convert_is_holiday("N") == 0
    assert convert_is_holiday(np.nan) == 0
    assert convert_is_holiday("") == 0
    assert convert_is_holiday("其他") == 0

def test_convert_is_maintenance():
    """Test is_maintenance conversion to 0/1."""
    assert convert_is_maintenance(1) == 1
    assert convert_is_maintenance("1") == 1
    assert convert_is_maintenance("是") == 1
    assert convert_is_maintenance(True) == 1
    assert convert_is_maintenance("True") == 1
    assert convert_is_maintenance("yes") == 1
    assert convert_is_maintenance("Y") == 1
    
    assert convert_is_maintenance(0) == 0
    assert convert_is_maintenance("0") == 0
    assert convert_is_maintenance("否") == 0
    assert convert_is_maintenance(False) == 0
    assert convert_is_maintenance("False") == 0
    assert convert_is_maintenance("no") == 0
    assert convert_is_maintenance("N") == 0
    assert convert_is_maintenance(np.nan) == 0
    assert convert_is_maintenance("") == 0
    assert convert_is_maintenance("其他") == 0

def test_data_preparation_integration(tmp_path):
    """Test complete data preparation workflow with sample data."""
    # Create test Excel file
    test_data = {
        "日期": pd.date_range(start="2024-01-01", periods=15).tolist(),
        "是否节假日": [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
        "是否检修": [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        "检修时长": [0, 0, 8, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
        "计划产量": [1000, 1200, 800, 1100, 1150, 1200, 1250, 900, 700, 1200, 1250, 1300, 1350, 1400, 1000],
        "实际产量": [980, 1180, 750, 1080, 1120, 1190, 1230, 880, 680, 1190, 1230, 1280, 1330, 1380, 980],
        "耗电量": [500, 520, 380, 510, 515, 525, 530, 450, 350, 520, 530, 540, 550, 560, 480],
        "外购电量": [300, 310, 220, 305, 308, 312, 315, 270, 200, 310, 315, 320, 325, 330, 290]
    }
    
    df = pd.DataFrame(test_data)
    test_file = tmp_path / "test_cold_rolling.xlsx"
    df.to_excel(test_file, sheet_name="冷轧", index=False)
    
    # Import and run main function
    import sys
    sys.argv = ["prepare_cold_rolling_data.py", "--input", str(test_file)]
    
    from scripts.prepare_cold_rolling_data import main
    main()
    
    # Check output files exist
    assert Path("data/raw/cold_rolling_power_data.csv").exists()
    assert Path("data/prediction/cold_rolling_predict_input.csv").exists()
    assert Path("outputs/reports/cold_rolling_truth_last7.csv").exists()
    
    # Verify training data
    train_df = pd.read_csv("data/raw/cold_rolling_power_data.csv")
    assert len(train_df) == 8  # 15 total - 7 rows with missing lag features = 8
    assert all(col in train_df.columns for col in ["purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"])
    assert train_df["is_holiday"].isin([0, 1]).all()
    assert train_df["is_maintenance"].isin([0, 1]).all()
    
    # Verify prediction input
    pred_df = pd.read_csv("data/prediction/cold_rolling_predict_input.csv")
    assert len(pred_df) == 7
    assert pred_df["purchase_power"].isna().all()
    assert pred_df["power_consumption"].isna().all()
    assert pred_df[["purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"]].notna().all().all()
    
    # Verify truth data
    truth_df = pd.read_csv("outputs/reports/cold_rolling_truth_last7.csv")
    assert len(truth_df) == 7
    assert truth_df[["date", "purchase_power", "power_consumption"]].notna().all().all()
    
    # Clean up test files
    Path("data/raw/cold_rolling_power_data.csv").unlink()
    Path("data/prediction/cold_rolling_predict_input.csv").unlink()
    Path("outputs/reports/cold_rolling_truth_last7.csv").unlink()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
