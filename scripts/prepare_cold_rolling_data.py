#!/usr/bin/env python3
"""Data preparation script for Cold Rolling electricity consumption dataset."""
import argparse
import pandas as pd
import numpy as np
from pathlib import Path

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Prepare Cold Rolling electricity consumption data.")
    parser.add_argument("--input", required=True, help="Path to input Excel file containing Cold Rolling sheet.")
    return parser.parse_args()

def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize Chinese column names to English fields."""
    column_mapping = {
        "日期": "date",
        "是否节假日": "is_holiday",
        "是否检修": "is_maintenance",
        "检修时长": "downtime_hours",
        "计划产量": "planned_output",
        "实际产量": "actual_output",
        "耗电量": "power_consumption",
        "外购电量": "purchase_power"
    }
    
    # Rename columns using mapping, keep original names for any not in mapping
    df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
    
    # Ensure all required columns exist
    required_columns = ["date", "is_holiday", "is_maintenance", "downtime_hours", 
                       "planned_output", "actual_output", "power_consumption", "purchase_power"]
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    return df

def convert_is_holiday(value: any) -> int:
    """Convert is_holiday value to 0/1 format."""
    if pd.isna(value):
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    str_val = str(value).strip().lower()
    return 1 if str_val in ["1", "是", "true", "yes", "y"] else 0

def convert_is_maintenance(value: any) -> int:
    """Convert is_maintenance value to 0/1 format."""
    if pd.isna(value):
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    str_val = str(value).strip().lower()
    return 1 if str_val in ["1", "是", "true", "yes", "y"] else 0

def main():
    args = parse_args()
    input_path = Path(args.input)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    # Read Cold Rolling sheet (try both English and Chinese names)
    try:
        df = pd.read_excel(input_path, sheet_name="Cold Rolling")
    except ValueError:
        try:
            df = pd.read_excel(input_path, sheet_name="冷轧")
        except ValueError:
            raise ValueError("No 'Cold Rolling' or '冷轧' sheet found in the input Excel file.")
    
    print(f"Loaded {len(df)} rows from Cold Rolling sheet.")
    
    # Normalize column names
    df = normalize_column_names(df)
    
    # Convert date to yyyy-mm-dd format
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    
    # Convert is_holiday
    df["is_holiday"] = df["is_holiday"].apply(convert_is_holiday)
    
    # Convert is_maintenance
    df["is_maintenance"] = df["is_maintenance"].apply(convert_is_maintenance)
    
    # Fill empty downtime_hours with 0
    df["downtime_hours"] = pd.to_numeric(df["downtime_hours"], errors="coerce").fillna(0)
    
    # Ensure numeric fields are numeric
    numeric_fields = ["planned_output", "actual_output", "power_consumption", "purchase_power"]
    for field in numeric_fields:
        df[field] = pd.to_numeric(df[field], errors="coerce")
    
    # Sort by date ascending
    df = df.sort_values("date").reset_index(drop=True)
    
    # Generate lag features
    df["purchase_lag_1"] = df["purchase_power"].shift(1)
    df["purchase_lag_7"] = df["purchase_power"].shift(7)
    df["purchase_rolling_7"] = df["purchase_power"].shift(1).rolling(window=7, min_periods=1).mean()
    
    # Drop rows with missing lag features
    df_clean = df.dropna(subset=["purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"]).reset_index(drop=True)
    print(f"After dropping rows with missing lag features: {len(df_clean)} rows remaining.")
    
    # Split last 7 rows as prediction input
    if len(df_clean) < 7:
        raise ValueError("Not enough valid rows to create prediction input (need at least 7).")
    
    prediction_input = df_clean.tail(7).copy()
    # Save ground truth for last 7 rows
    truth_last7 = prediction_input[["date", "purchase_power", "power_consumption"]].copy()
    # Set target fields to NaN for prediction input
    prediction_input[["purchase_power", "power_consumption"]] = np.nan
    
    # Create output directories if they don't exist
    Path("data/raw").mkdir(parents=True, exist_ok=True)
    Path("data/prediction").mkdir(parents=True, exist_ok=True)
    Path("outputs/reports").mkdir(parents=True, exist_ok=True)
    
    # Save outputs
    df_clean.to_csv("data/raw/cold_rolling_power_data.csv", index=False, encoding="utf-8")
    prediction_input.to_csv("data/prediction/cold_rolling_predict_input.csv", index=False, encoding="utf-8")
    truth_last7.to_csv("outputs/reports/cold_rolling_truth_last7.csv", index=False, encoding="utf-8")
    
    print("Data preparation completed successfully!")
    print(f"Training data saved to: data/raw/cold_rolling_power_data.csv ({len(df_clean)} rows)")
    print(f"Prediction input saved to: data/prediction/cold_rolling_predict_input.csv ({len(prediction_input)} rows)")
    print(f"Ground truth for last 7 days saved to: outputs/reports/cold_rolling_truth_last7.csv")

if __name__ == "__main__":
    main()
