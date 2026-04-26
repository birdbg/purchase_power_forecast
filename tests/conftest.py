"""Pytest configuration and fixtures for the test suite."""

from __future__ import annotations

import pytest
import sys
import subprocess
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def sample_data_path() -> Path:
    """Path to sample power data, auto-generate if not exists."""
    data_path = project_root / "data" / "raw" / "sample_power_data.csv"
    if not data_path.exists():
        # Generate sample data if not exists
        subprocess.run(
            [sys.executable, str(project_root / "scripts" / "generate_sample_data.py")],
            cwd=project_root,
            capture_output=True
        )
    return data_path


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
