"""Data loading utilities for external power forecasting system."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

logger = logging.getLogger(__name__)


class DataLoadError(Exception):
    """Custom exception for data loading errors."""
    pass


class ConfigLoadError(Exception):
    """Custom exception for configuration loading errors."""
    pass


def load_tabular_data(path: str | Path, sheet_name: str | int | None = 0) -> pd.DataFrame:
    """Load tabular data from CSV or Excel file.

    Args:
        path: Path to the data file (CSV or Excel).
        sheet_name: Sheet name or index for Excel files. Default is first sheet (0).

    Returns:
        pandas DataFrame containing the loaded data.

    Raises:
        DataLoadError: If file not found, format unsupported, or read operation fails.
    """
    data_path = Path(path).expanduser()

    if not data_path.exists():
        raise DataLoadError(f"Data file not found: {data_path}")

    suffix = data_path.suffix.lower()

    try:
        if suffix == ".csv":
            df = pd.read_csv(data_path)
            logger.info(f"Successfully loaded CSV file: {data_path} ({len(df)} rows)")
            return df
        elif suffix in {".xls", ".xlsx"}:
            df = pd.read_excel(data_path, sheet_name=sheet_name)
            logger.info(f"Successfully loaded Excel file: {data_path} ({len(df)} rows)")
            return df
        else:
            raise DataLoadError(
                f"Unsupported file format: {suffix}. Please use CSV, XLS, or XLSX."
            )
    except pd.errors.EmptyDataError:
        raise DataLoadError(f"Data file is empty: {data_path}")
    except pd.errors.ParserError as e:
        raise DataLoadError(f"Failed to parse data file: {data_path}. Error: {e}")
    except Exception as e:
        raise DataLoadError(f"Failed to read data file: {data_path}. Error: {e}")


def save_tabular_data(df: pd.DataFrame, path: str | Path) -> Path:
    """Save DataFrame to CSV or Excel file.

    Args:
        df: pandas DataFrame to save.
        path: Output file path.

    Returns:
        Path to the saved file.

    Raises:
        DataLoadError: If output format unsupported or write operation fails.
    """
    output_path = Path(path).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    suffix = output_path.suffix.lower()

    try:
        if suffix == ".csv":
            df.to_csv(output_path, index=False)
        elif suffix in {".xls", ".xlsx"}:
            df.to_excel(output_path, index=False)
        else:
            raise DataLoadError(
                f"Unsupported output format: {suffix}. Please use CSV, XLS, or XLSX."
            )
        logger.info(f"Successfully saved data to: {output_path}")
        return output_path
    except Exception as e:
        raise DataLoadError(f"Failed to save data to: {output_path}. Error: {e}")


def load_config(config_path: str | Path | None = None) -> dict[str, Any]:
    """Load YAML configuration file.

    Args:
        config_path: Path to the YAML config file. If None, uses default path.

    Returns:
        Dictionary containing configuration values.

    Raises:
        ConfigLoadError: If config file not found or parsing fails.
    """
    if config_path is None:
        # Default to config/data_config.yaml in project root
        config_path = Path(__file__).parent.parent.parent / "config" / "data_config.yaml"
    else:
        config_path = Path(config_path).expanduser()

    if not config_path.exists():
        raise ConfigLoadError(f"Config file not found: {config_path}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        logger.info(f"Successfully loaded config from: {config_path}")
        return config or {}
    except yaml.YAMLError as e:
        raise ConfigLoadError(f"Failed to parse YAML config: {config_path}. Error: {e}")
    except Exception as e:
        raise ConfigLoadError(f"Failed to read config file: {config_path}. Error: {e}")


def get_data_path(config: dict[str, Any], data_key: str) -> Path:
    """Get data path from config dictionary.

    Args:
        config: Configuration dictionary loaded from YAML.
        data_key: Key for the data path (e.g., 'raw_data_path').

    Returns:
        Path object constructed relative to project root.

    Raises:
        KeyError: If data_key not found in config.
    """
    if data_key not in config:
        raise KeyError(f"Data key '{data_key}' not found in config")

    # Paths are relative to project root
    project_root = Path(__file__).parent.parent.parent
    data_path = project_root / config[data_key]

    return data_path


if __name__ == "__main__":
    """Test entry point: load sample data and print first 5 rows."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    print("=" * 60)
    print("Testing data loading functionality")
    print("=" * 60)

    try:
        # Load config to get default data path
        config = load_config()
        print(f"\n[Config loaded successfully]")

        # Get data path from config
        raw_data_path = get_data_path(config, "raw_data_path")
        print(f"Raw data path from config: {raw_data_path}")

        # Load sample data
        df = load_tabular_data(raw_data_path)

        print(f"\n[Data loaded successfully]")
        print(f"Shape: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        print(f"\nFirst 5 rows:")
        print(df.head().to_string())

    except DataLoadError as e:
        print(f"\n[DataLoadError] {e}")
    except ConfigLoadError as e:
        print(f"\n[ConfigLoadError] {e}")
    except KeyError as e:
        print(f"\n[KeyError] {e}")
    except Exception as e:
        print(f"\n[Unexpected Error] {e}")
