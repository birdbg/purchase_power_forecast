"""Pytest configuration and fixtures for the test suite."""

from __future__ import annotations

import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def sample_data_path() -> Path:
    """Path to sample power data."""
    return project_root / "data" / "raw" / "sample_power_data.csv"


@pytest.fixture
def data_config_path() -> Path:
    """Path to data config."""
    return project_root / "config" / "data_config.yaml"


@pytest.fixture
def model_config_path() -> Path:
    """Path to model config."""
    return project_root / "config" / "model_config.yaml"


@pytest.fixture
def temp_model_dir(tmp_path) -> Path:
    """Temporary directory for model storage in tests."""
    model_dir = tmp_path / "test_model_store"
    model_dir.mkdir()
    return model_dir
