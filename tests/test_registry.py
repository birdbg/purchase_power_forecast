"""Tests for model registry module."""

from __future__ import annotations

import pytest
import yaml
from pathlib import Path
import joblib

from src.registry.model_registry import (
    ModelRegistry,
    ModelNotFoundError,
    ModelRegistryError,
)


class TestModelRegistry:
    """Test cases for model registry functionality."""

    @pytest.fixture
    def registry(self, temp_model_dir):
        """Create a fresh registry for testing."""
        return ModelRegistry(model_name="test_model", store_dir=temp_model_dir)

    def test_register_model(self, registry, sample_data_path):
        """Test registering a new model."""
        # Create a dummy model artifact
        from sklearn.ensemble import RandomForestRegressor
        import pandas as pd

        # Create dummy model
        model = RandomForestRegressor(n_estimators=10, random_state=42)
        X_dummy = pd.DataFrame({"feature1": [1, 2, 3], "feature2": [4, 5, 6]})
        y_dummy = [10, 20, 30]
        model.fit(X_dummy, y_dummy)

        # Save model to a temp file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            joblib.dump(model, f.name)
            artifact_path = f.name

        # Register model
        model_id = "test_v001"
        manifest = registry.register_model(
            model_id=model_id,
            model_artifact_path=artifact_path,
            feature_list=["feature1", "feature2"],
            metrics={"mae": 5.0, "mape": 10.0, "rmse": 6.0, "r2": 0.9, "max_error": 15.0},
            metadata={"description": "Test model"},
        )

        # Verify registration
        assert manifest["model_id"] == model_id
        assert manifest["status"] == "candidate"
        assert manifest["feature_list"] == ["feature1", "feature2"]
        assert manifest["metrics"]["mae"] == 5.0

        # Clean up temp file
        Path(artifact_path).unlink()

    def test_register_and_list_versions(self, registry, temp_model_dir):
        """Test registering multiple models and listing them."""
        from sklearn.ensemble import RandomForestRegressor
        import pandas as pd
        import tempfile

        # Register first model
        model1 = RandomForestRegressor(n_estimators=10, random_state=42)
        X_dummy = pd.DataFrame({"feature1": [1, 2, 3], "feature2": [4, 5, 6]})
        y_dummy = [10, 20, 30]
        model1.fit(X_dummy, y_dummy)

        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            joblib.dump(model1, f.name)
            artifact_path1 = f.name

        manifest1 = registry.register_model(
            model_id="test_v001",
            model_artifact_path=artifact_path1,
            feature_list=["feature1", "feature2"],
            metrics={"mae": 5.0, "mape": 10.0, "rmse": 6.0, "r2": 0.9, "max_error": 15.0},
        )
        Path(artifact_path1).unlink()

        # Register second model
        model2 = RandomForestRegressor(n_estimators=10, random_state=43)
        model2.fit(X_dummy, y_dummy)

        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            joblib.dump(model2, f.name)
            artifact_path2 = f.name

        manifest2 = registry.register_model(
            model_id="test_v002",
            model_artifact_path=artifact_path2,
            feature_list=["feature1", "feature2"],
            metrics={"mae": 4.5, "mape": 9.0, "rmse": 5.5, "r2": 0.92, "max_error": 12.0},
        )
        Path(artifact_path2).unlink()

        # List versions
        versions = registry.list_versions()
        assert len(versions) == 2

        # Verify model IDs are present
        model_ids = [v["model_id"] for v in versions]
        assert "test_v001" in model_ids
        assert "test_v002" in model_ids

    def test_promote_to_production(self, registry):
        """Test promoting a model to production."""
        from sklearn.ensemble import RandomForestRegressor
        import pandas as pd
        import tempfile

        # Register model
        model = RandomForestRegressor(n_estimators=10, random_state=42)
        X_dummy = pd.DataFrame({"feature1": [1, 2, 3], "feature2": [4, 5, 6]})
        y_dummy = [10, 20, 30]
        model.fit(X_dummy, y_dummy)

        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            joblib.dump(model, f.name)
            artifact_path = f.name

        registry.register_model(
            model_id="test_v001",
            model_artifact_path=artifact_path,
            feature_list=["feature1", "feature2"],
            metrics={"mae": 5.0, "mape": 10.0, "rmse": 6.0, "r2": 0.9, "max_error": 15.0},
        )
        Path(artifact_path).unlink()

        # Promote to production
        manifest = registry.promote_to_production("test_v001")

        # Verify promotion
        assert manifest["status"] == "production"
        assert "promoted_at" in manifest

        # Verify production model info
        prod_info = registry.get_production_model_info()
        assert prod_info["model_id"] == "test_v001"
        assert prod_info["status"] == "production"

    def test_promote_nonexistent_model_raises_error(self, registry):
        """Test that promoting a nonexistent model raises an error."""
        with pytest.raises(ModelNotFoundError):
            registry.promote_to_production("nonexistent_model")

    def test_get_production_model_info_no_production(self, registry):
        """Test that getting production info when no production model raises error."""
        with pytest.raises(ModelNotFoundError):
            registry.get_production_model_info()

    def test_get_registry_summary(self, registry):
        """Test getting registry summary."""
        summary = registry.get_registry_summary()

        assert "model_name" in summary
        assert "total_versions" in summary
        assert "production_model_id" in summary
        assert summary["total_versions"] == 0
