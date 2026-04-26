"""Evaluation metrics utilities for external power forecasting system."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def evaluate_regression(y_true, y_pred) -> dict[str, float]:
    """Calculate comprehensive regression metrics for model evaluation.

    Metrics calculated:
        - mae: Mean Absolute Error
        - mape: Mean Absolute Percentage Error (%)
        - rmse: Root Mean Squared Error
        - r2: R-squared score
        - max_error: Maximum absolute error

    Args:
        y_true: Ground truth target values.
        y_pred: Predicted values.

    Returns:
        Dictionary containing all metric values as Python floats.

    Note:
        MAPE handles y_true == 0 by excluding those values from calculation
        to avoid division by zero. If all y_true values are zero, MAPE returns nan.
    """
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)

    # Validate input shapes
    if y_true_arr.shape != y_pred_arr.shape:
        raise ValueError(
            f"Shape mismatch: y_true {y_true_arr.shape} vs y_pred {y_pred_arr.shape}"
        )

    # Calculate MAE
    mae = float(mean_absolute_error(y_true_arr, y_pred_arr))

    # Calculate MAPE (handle y_true == 0 to avoid division by zero)
    # Use threshold of 1e-8 to identify non-zero values
    non_zero_mask = np.abs(y_true_arr) > 1e-8
    if non_zero_mask.any():
        mape_arr = np.abs(
            (y_true_arr[non_zero_mask] - y_pred_arr[non_zero_mask]) 
            / y_true_arr[non_zero_mask]
        )
        mape = float(np.mean(mape_arr)) * 100  # Convert to percentage
    else:
        mape = float("nan")

    # Calculate RMSE
    rmse = float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr)))

    # Calculate R2
    r2 = float(r2_score(y_true_arr, y_pred_arr))

    # Calculate max_error (maximum absolute error)
    max_error = float(np.max(np.abs(y_true_arr - y_pred_arr)))

    return {
        "mae": mae,
        "mape": mape,
        "rmse": rmse,
        "r2": r2,
        "max_error": max_error,
    }


def print_metrics(metrics: dict[str, float], title: str = "模型评估结果") -> None:
    """Print formatted regression metrics to console.

    Args:
        metrics: Dictionary of metric values from evaluate_regression().
        title: Optional title for the report.
    """
    print("=" * 50)
    print(f"  {title}")
    print("=" * 50)

    # Format each metric
    format_mapping = {
        "mae": ("MAE (平均绝对误差)", ".2f"),
        "mape": ("MAPE (平均绝对百分比误差)", ".2f"),
        "rmse": ("RMSE (均方根误差)", ".2f"),
        "r2": ("R² (决定系数)", ".4f"),
        "max_error": ("Max Error (最大误差)", ".2f"),
    }

    for key, (name, fmt) in format_mapping.items():
        if key in metrics:
            value = metrics[key]
            if value == float("nan"):
                formatted = "N/A"
            else:
                formatted = f"{value:{fmt}}"
            print(f"  {name}: {formatted}")

    print("=" * 50)


if __name__ == "__main__":
    """Unit tests for evaluation metrics."""
    print("=" * 50)
    print("  Metrics Module Unit Tests")
    print("=" * 50)

    # Test Case 1: Basic predictions
    print("\n[Test 1] Basic predictions")
    y_true = np.array([100, 200, 300, 400, 500])
    y_pred = np.array([110, 190, 310, 380, 520])

    metrics = evaluate_regression(y_true, y_pred)
    print(f"y_true: {y_true}")
    print(f"y_pred: {y_pred}")
    print_metrics(metrics, "Test 1: Basic Predictions")

    # Test Case 2: Perfect predictions
    print("\n[Test 2] Perfect predictions")
    y_true = np.array([100, 200, 300, 400, 500])
    y_pred = np.array([100, 200, 300, 400, 500])

    metrics = evaluate_regression(y_true, y_pred)
    print_metrics(metrics, "Test 2: Perfect Predictions")

    # Test Case 3: With zero values in y_true (MAPE should handle gracefully)
    print("\n[Test 3] With zero values in y_true")
    y_true = np.array([0, 100, 200, 300, 400])
    y_pred = np.array([10, 110, 190, 310, 420])

    metrics = evaluate_regression(y_true, y_pred)
    print_metrics(metrics, "Test 3: With Zero Values")

    # Test Case 4: Realistic forecasting scenario
    print("\n[Test 4] Realistic forecasting scenario")
    np.random.seed(42)
    y_true = np.array([800, 850, 820, 900, 870, 910, 880, 950, 920, 980])
    # Add some noise to simulate predictions
    noise = np.random.normal(0, 30, size=y_true.shape)
    y_pred = y_true + noise

    metrics = evaluate_regression(y_true, y_pred)
    print_metrics(metrics, "Test 4: Realistic Scenario")

    # Test Case 5: Verify all values are Python floats
    print("\n[Test 5] Verify return types")
    y_true = np.array([100, 200, 300])
    y_pred = np.array([110, 180, 320])
    metrics = evaluate_regression(y_true, y_pred)

    print("Return value types:")
    for key, value in metrics.items():
        print(f"  {key}: {type(value).__name__} = {value}")

    # Validate all values are Python native types
    all_native = all(isinstance(v, (int, float)) for v in metrics.values())
    print(f"\nAll values are Python native types: {all_native}")

    print("\n" + "=" * 50)
    print("  All tests completed!")
    print("=" * 50)
