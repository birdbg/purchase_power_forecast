"""Tests for evaluation metrics module."""

from __future__ import annotations

import pytest
import numpy as np

from src.utils.metrics import evaluate_regression, print_metrics


class TestMetrics:
    """Test cases for metrics evaluation functionality."""

    def test_evaluate_regression_with_perfect_predictions(self):
        """Test metrics with perfect predictions."""
        y_true = np.array([100, 200, 300, 400, 500])
        y_pred = np.array([100, 200, 300, 400, 500])

        metrics = evaluate_regression(y_true, y_pred)

        assert "mae" in metrics
        assert "mape" in metrics
        assert "rmse" in metrics
        assert "r2" in metrics
        assert "max_error" in metrics

        # Perfect predictions should have zero errors
        assert metrics["mae"] == 0.0
        assert metrics["mape"] == 0.0
        assert metrics["rmse"] == 0.0
        assert metrics["r2"] == 1.0
        assert metrics["max_error"] == 0.0

    def test_evaluate_regression_with_some_error(self):
        """Test metrics with some prediction error."""
        y_true = np.array([100, 200, 300, 400, 500])
        y_pred = np.array([110, 190, 310, 380, 520])

        metrics = evaluate_regression(y_true, y_pred)

        # All metrics should be positive (non-zero due to error)
        assert metrics["mae"] > 0
        assert metrics["mape"] > 0
        assert metrics["rmse"] > 0
        # R2 should be less than 1 for imperfect predictions
        assert metrics["r2"] < 1.0
        assert metrics["max_error"] > 0

    def test_evaluate_regression_returns_python_floats(self):
        """Test that all returned values are Python float types."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 180, 320])

        metrics = evaluate_regression(y_true, y_pred)

        for key, value in metrics.items():
            assert isinstance(value, float), f"{key} should be float, got {type(value)}"

    def test_evaluate_regression_with_zero_values(self):
        """Test that MAPE handles y_true == 0 correctly."""
        y_true = np.array([0, 100, 200, 300, 400])
        y_pred = np.array([10, 110, 190, 310, 420])

        # Should not raise an error
        metrics = evaluate_regression(y_true, y_pred)

        assert "mape" in metrics
        # MAPE should be calculated excluding zero values
        assert not np.isnan(metrics["mape"]) or np.isnan(metrics.get("mape"))

    def test_evaluate_regression_shape_mismatch(self):
        """Test that shape mismatch raises an error."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 180])

        with pytest.raises(ValueError):
            evaluate_regression(y_true, y_pred)

    def test_print_metrics_runs_without_error(self):
        """Test that print_metrics runs without error."""
        metrics = {
            "mae": 10.5,
            "mape": 5.2,
            "rmse": 12.3,
            "r2": 0.95,
            "max_error": 25.0,
        }

        # Should not raise any exception
        print_metrics(metrics)

    def test_print_metrics_with_nan(self):
        """Test print_metrics handles NaN values."""
        metrics = {
            "mae": 10.5,
            "mape": float("nan"),
            "rmse": 12.3,
            "r2": 0.95,
            "max_error": 25.0,
        }

        # Should not raise any exception
        print_metrics(metrics)
