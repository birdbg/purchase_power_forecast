"""Model registry module for external power forecasting system.

This module provides model version management including:
- Model registration (save model artifacts and metadata)
- Model promotion (candidate -> production -> archived)
- Production model retrieval
- Model rollback
- Version listing

Directory structure:
    model_store/
    └── purchase_power/
        ├── registry.json
        ├── v20260426_001/
        │   ├── model.joblib
        │   ├── manifest.json
        │   ├── feature_list.json
        │   └── metrics.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


class ModelRegistryError(Exception):
    """Base exception for model registry errors."""
    pass


class ModelNotFoundError(ModelRegistryError):
    """Raised when a model is not found in the registry."""
    pass


class InvalidStateError(ModelRegistryError):
    """Raised when a model state transition is invalid."""
    pass


class ModelRegistry:
    """Model registry for managing model versions and lifecycle.

    Attributes:
        model_name: Name of the model (e.g., 'purchase_power').
        store_dir: Root directory for model storage.
        registry_file: Path to the registry JSON file.
    """

    # Valid model states
    STATES = ["candidate", "staging", "production", "archived", "rejected"]

    def __init__(
        self,
        model_name: str = "purchase_power",
        store_dir: str | Path = "model_store",
    ):
        """Initialize the model registry.

        Args:
            model_name: Name of the model. Used as subdirectory name.
            store_dir: Root directory for model storage.
        """
        self.model_name = model_name
        self.store_dir = Path(store_dir)
        self.model_dir = self.store_dir / model_name
        self.registry_file = self.model_dir / "registry.json"

        # Create directories if they don't exist
        self.model_dir.mkdir(parents=True, exist_ok=True)

    # ==================== Core Methods ====================

    def register_model(
        self,
        model_id: str,
        model_artifact_path: str | Path,
        feature_list: list[str],
        metrics: dict[str, float],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Register a new model version.

        This method:
            1. Copies model artifact to version directory
            2. Saves feature_list.json
            3. Saves metrics.json
            4. Saves manifest.json
            5. Updates registry.json with new model entry

        Args:
            model_id: Unique model version ID (e.g., 'v20260426_001').
            model_artifact_path: Path to the trained model file (.joblib).
            feature_list: List of feature column names.
            metrics: Dictionary of evaluation metrics.
            metadata: Optional additional metadata.

        Returns:
            The registered model record.

        Raises:
            ModelRegistryError: If model artifact file doesn't exist.
        """
        artifact_path = Path(model_artifact_path)
        if not artifact_path.exists():
            raise ModelRegistryError(f"Model artifact not found: {artifact_path}")

        # Create version directory
        version_dir = self.model_dir / model_id
        version_dir.mkdir(parents=True, exist_ok=True)

        # Copy model artifact
        import shutil
        dest_artifact = version_dir / "model.joblib"
        shutil.copy2(artifact_path, dest_artifact)

        # Save feature_list.json
        feature_list_file = version_dir / "feature_list.json"
        with open(feature_list_file, "w", encoding="utf-8") as f:
            json.dump(feature_list, f, ensure_ascii=False, indent=2)

        # Save metrics.json
        metrics_file = version_dir / "metrics.json"
        with open(metrics_file, "w", encoding="utf-8") as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)

        # Save manifest.json
        manifest = {
            "model_id": model_id,
            "model_name": self.model_name,
            "algorithm": metadata.get("algorithm") if metadata else None,
            "params": metadata.get("params") if metadata else None,
            "target": metadata.get("target") if metadata else None,
            "train_data_start": metadata.get("train_data_start") if metadata else None,
            "train_data_end": metadata.get("train_data_end") if metadata else None,
            "created_at": metadata.get("created_at") if metadata else None,
            "status": "candidate",
            "registered_at": datetime.now().isoformat(),
            "artifact_path": str(dest_artifact),
            "feature_list_path": str(feature_list_file),
            "metrics_path": str(metrics_file),
            "feature_list": feature_list,
            "metrics": metrics,
        }
        if metadata:
            manifest.update(metadata)

        manifest_file = version_dir / "manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        # Update registry.json
        registry = self._load_registry()
        registry["models"] = [
            m for m in registry.get("models", []) if m.get("model_id") != model_id
        ]
        registry["models"].append(manifest)
        registry["updated_at"] = datetime.now().isoformat()
        self._save_registry(registry)

        return manifest

    def promote_to_production(self, model_id: str) -> dict[str, Any]:
        """Promote a candidate or staging model to production.

        This method:
            1. Sets the specified model status to 'production'
            2. Archives any existing production model
            3. Updates the registry
            4. Updates the manifest file

        Args:
            model_id: ID of the model to promote.

        Returns:
            The promoted model manifest.

        Raises:
            ModelNotFoundError: If model_id not found.
            InvalidStateError: If model transition is invalid.
        """
        registry = self._load_registry()
        production_status = "production"
        archived_status = "archived"
        
        # Find target model
        model = next((m for m in registry.get("models", []) if m.get("model_id") == model_id), None)
        if not model:
            raise ModelNotFoundError(f"Model not found: {model_id}")

        # Validate state transition
        if model.get("status") == production_status:
            raise InvalidStateError(f"Model is already in production: {model_id}")
        if model.get("status") not in ["candidate", "staging"]:
            raise InvalidStateError(f"Cannot promote model with status '{model.get('status')}'. Only candidate or staging models can be promoted.")

        # Find existing production models and archive them
        existing_production = [m for m in registry.get("models", []) if m.get("status") == production_status]
        for prod_model in existing_production:
            prod_model["status"] = archived_status
            prod_model["archived_at"] = datetime.now().isoformat()
            # Update manifest file
            prod_manifest_path = Path(prod_model.get("artifact_path")).parent / "manifest.json"
            if prod_manifest_path.exists():
                with open(prod_manifest_path, "r", encoding="utf-8") as f:
                    prod_manifest = json.load(f)
                prod_manifest.update(prod_model)
                with open(prod_manifest_path, "w", encoding="utf-8") as f:
                    json.dump(prod_manifest, f, ensure_ascii=False, indent=2)
        
        # Update target model to production
        model["status"] = production_status
        model["promoted_at"] = datetime.now().isoformat()
        registry["production_model_id"] = model_id
        
        # Update manifest file
        manifest_path = Path(model.get("artifact_path")).parent / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            manifest.update(model)
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        # Save registry
        registry["updated_at"] = datetime.now().isoformat()
        self._save_registry(registry)
        
        # Get updated manifest
        return self.get_model_info(model_id)

    def rollback(self, model_id: str) -> dict[str, Any]:
        """Rollback a model to production status.

        This method:
            1. Archives the current production model
            2. Sets the specified model to production
            
        Only archived models can be rolled back.
        
        Args:
            model_id: ID of the model to rollback.
            
        Returns:
            The rolled back model manifest.
            
        Raises:
            ModelNotFoundError: If model_id not found.
            InvalidStateError: If model transition is invalid.
        """
        registry = self._load_registry()
        production_status = "production"
        archived_status = "archived"
        
        # Find the model to rollback
        model = next((m for m in registry.get("models", []) if m.get("model_id") == model_id), None)
        if not model:
            raise ModelNotFoundError(f"Model not found: {model_id}")
        
        # Validate state transition
        current_status = model.get("status")
        if current_status != archived_status:
            raise InvalidStateError(f"Cannot rollback model {model_id} with status {current_status}. Only archived models can be rolled back.")
        
        # Find existing production models and archive them
        existing_production = [m for m in registry.get("models", []) if m.get("status") == production_status]
        for prod_model in existing_production:
            prod_model["status"] = archived_status
            prod_model["archived_at"] = datetime.now().isoformat()
            # Update manifest file
            prod_manifest_path = Path(prod_model.get("artifact_path")).parent / "manifest.json"
            if prod_manifest_path.exists():
                with open(prod_manifest_path, "r", encoding="utf-8") as f:
                    prod_manifest = json.load(f)
                prod_manifest.update(prod_model)
                with open(prod_manifest_path, "w", encoding="utf-8") as f:
                    json.dump(prod_manifest, f, ensure_ascii=False, indent=2)
        
        # Update target model to production
        model["status"] = production_status
        model["rolled_back_at"] = datetime.now().isoformat()
        registry["production_model_id"] = model_id
        
        # Update manifest file
        manifest_path = Path(model.get("artifact_path")).parent / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            manifest.update(model)
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        # Save registry
        registry["updated_at"] = datetime.now().isoformat()
        self._save_registry(registry)
        
        return model
    
    def reject_model(self, model_id: str, reason: str | None = None) -> dict[str, Any]:
        """Reject a model version.

        Args:
            model_id: ID of the model to reject.
            reason: Optional reason for rejection.

        Returns:
            The updated model manifest.
        """
        registry = self._load_registry()
        
        found = False
        for model in registry.get("models", []):
            if model.get("model_id") == model_id:
                if model.get("status") == "production":
                    raise InvalidStateError(f"Cannot reject production model: {model_id}")
                model["status"] = "rejected"
                model["rejected_at"] = datetime.now().isoformat()
                model["rejection_reason"] = reason
                found = True
        
        if not found:
            raise ModelNotFoundError(f"Model not found: {model_id}")
        
        registry["updated_at"] = datetime.now().isoformat()
        self._save_registry(registry)
        
        # Update manifest file
        manifest = self.get_model_info(model_id)
        manifest["status"] = "rejected"
        manifest["rejected_at"] = registry["updated_at"]
        manifest["rejection_reason"] = reason
        manifest_file = self.model_dir / model_id / "manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return manifest
    
    def archive_model(self, model_id: str) -> dict[str, Any]:
        """Archive a model version.

        Args:
            model_id: ID of the model to archive.

        Returns:
            The updated model manifest.
        """
        registry = self._load_registry()
        
        found = False
        for model in registry.get("models", []):
            if model.get("model_id") == model_id:
                if model.get("status") == "production":
                    raise InvalidStateError(f"Cannot archive production model: {model_id}. Please rollback first.")
                model["status"] = "archived"
                model["archived_at"] = datetime.now().isoformat()
                found = True
        
        if not found:
            raise ModelNotFoundError(f"Model not found: {model_id}")
        
        registry["updated_at"] = datetime.now().isoformat()
        self._save_registry(registry)
        
        # Update manifest file
        manifest = self.get_model_info(model_id)
        manifest["status"] = "archived"
        manifest["archived_at"] = registry["updated_at"]
        manifest_file = self.model_dir / model_id / "manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return manifest

    def get_production_model_info(self) -> dict[str, Any]:
        """Get the current production model manifest.

        Returns:
            The production model manifest.

        Raises:
            ModelNotFoundError: If no production model exists.
        """
        registry = self._load_registry()
        production_id = registry.get("production_model_id")

        if not production_id:
            raise ModelNotFoundError("No production model found. Train and promote a model first.")

        return self.get_model_info(production_id)

    def get_model_info(self, model_id: str) -> dict[str, Any]:
        """Get manifest for a specific model version.

        Args:
            model_id: ID of the model.

        Returns:
            The model manifest.

        Raises:
            ModelNotFoundError: If model not found.
        """
        manifest_file = self.model_dir / model_id / "manifest.json"
        if not manifest_file.exists():
            raise ModelNotFoundError(f"Model manifest not found: {manifest_file}")

        with open(manifest_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_versions(self) -> list[dict[str, Any]]:
        """List all model versions with their status.

        Returns:
            List of model records sorted by registration time (newest first).
        """
        registry = self._load_registry()
        models = registry.get("models", [])

        # Sort by registered_at (newest first)
        sorted_models = sorted(
            models,
            key=lambda x: x.get("registered_at", ""),
            reverse=True
        )

        return sorted_models

    def get_registry_summary(self) -> dict[str, Any]:
        """Get a summary of the registry.

        Returns:
            Dictionary with registry statistics.
        """
        registry = self._load_registry()
        models = registry.get("models", [])

        summary = {
            "model_name": self.model_name,
            "total_versions": len(models),
            "production_model_id": registry.get("production_model_id"),
            "candidate_count": sum(1 for m in models if m.get("status") == "candidate"),
            "staging_count": sum(1 for m in models if m.get("status") == "staging"),
            "production_count": sum(1 for m in models if m.get("status") == "production"),
            "archived_count": sum(1 for m in models if m.get("status") == "archived"),
            "rejected_count": sum(1 for m in models if m.get("status") == "rejected"),
        }

        return summary

    # ==================== Private Methods ====================

    def _load_registry(self) -> dict[str, Any]:
        """Load registry JSON file.

        Returns:
            Registry dictionary. Returns empty structure if file doesn't exist.
        """
        if not self.registry_file.exists():
            return {
                "model_name": self.model_name,
                "production_model_id": None,
                "models": [],
                "created_at": datetime.now().isoformat(),
            }

        with open(self.registry_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_registry(self, registry: dict[str, Any]) -> None:
        """Save registry JSON file.

        Args:
            registry: Registry dictionary to save.
        """
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)


# ==================== CLI Support ====================

def _create_parser() -> argparse.ArgumentParser:
    """Create CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="外购电预测模型注册表管理",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", required=True, help="子命令")

    # list command
    list_parser = subparsers.add_parser("list", help="列出所有模型版本")
    list_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    list_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    # promote command
    promote_parser = subparsers.add_parser("promote", help="将候选模型提升为生产模型")
    promote_parser.add_argument("model_id", help="模型版本ID")
    promote_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    promote_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    # rollback command
    rollback_parser = subparsers.add_parser("rollback", help="回滚模型到指定版本")
    rollback_parser.add_argument("model_id", help="模型版本ID")
    rollback_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    rollback_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    # reject command
    reject_parser = subparsers.add_parser("reject", help="拒绝指定模型版本")
    reject_parser.add_argument("model_id", help="模型版本ID")
    reject_parser.add_argument(
        "--reason",
        default=None,
        help="拒绝原因"
    )
    reject_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    reject_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    # archive command
    archive_parser = subparsers.add_parser("archive", help="归档指定模型版本")
    archive_parser.add_argument("model_id", help="模型版本ID")
    archive_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    archive_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    # info command
    info_parser = subparsers.add_parser("info", help="查看生产模型信息")
    info_parser.add_argument(
        "--model-name",
        default="purchase_power",
        help="模型名称"
    )
    info_parser.add_argument(
        "--store-dir",
        default="model_store",
        help="模型存储目录"
    )

    return parser


def main() -> None:
    """CLI entry point."""
    parser = _create_parser()
    args = parser.parse_args()

    registry = ModelRegistry(model_name=args.model_name, store_dir=args.store_dir)

    try:
        if args.command == "list":
            models = registry.list_versions()
            print("=" * 60)
            print(f"  模型版本列表 ({registry.model_name})")
            print("=" * 60)

            if not models:
                print("  暂无注册的模型版本")
            else:
                for model in models:
                    status = model.get("status", "unknown")
                    model_id = model.get("model_id", "unknown")
                    registered = model.get("registered_at", "unknown")
                    metrics = model.get("metrics", {})
                    mape = metrics.get("mape", "N/A")

                    status_symbol = {
                        "candidate": "[候选]",
                        "staging": "[预发]",
                        "production": "[生产]",
                        "archived": "[归档]",
                        "rejected": "[已拒绝]"
                    }.get(status, f"[{status}]")

                    print(f"\n  {status_symbol} {model_id}")
                    print(f"    注册时间: {registered}")
                    print(f"    MAPE: {mape}%")

            print("\n" + "=" * 60)
            summary = registry.get_registry_summary()
            print(f"总计: {summary['total_versions']} 个版本")
            print(f"  候选: {summary['candidate_count']}")
            print(f"  预发: {summary['staging_count']}")
            print(f"  生产: {summary['production_count']}")
            print(f"  归档: {summary['archived_count']}")
            print(f"  已拒绝: {summary['rejected_count']}")
            print("=" * 60)

        elif args.command == "promote":
            print(f"正在提升模型 {args.model_id} 到生产环境...")
            manifest = registry.promote_to_production(args.model_id)
            print(f"\n✅ 模型已提升为生产模型")
            print(f"   模型ID: {manifest['model_id']}")
            print(f"   提升时间: {manifest.get('promoted_at')}")

        elif args.command == "rollback":
            print(f"正在回滚模型到 {args.model_id}...")
            manifest = registry.rollback(args.model_id)
            print(f"\n✅ 模型已回滚")
            print(f"   模型ID: {manifest['model_id']}")
            print(f"   回滚时间: {manifest.get('rolled_back_at')}")

        elif args.command == "reject":
            print(f"正在拒绝模型 {args.model_id}...")
            manifest = registry.reject_model(args.model_id, args.reason)
            print(f"\n✅ 模型已拒绝")
            print(f"   模型ID: {manifest['model_id']}")
            print(f"   拒绝时间: {manifest.get('rejected_at')}")
            if args.reason:
                print(f"   拒绝原因: {args.reason}")

        elif args.command == "archive":
            print(f"正在归档模型 {args.model_id}...")
            manifest = registry.archive_model(args.model_id)
            print(f"\n✅ 模型已归档")
            print(f"   模型ID: {manifest['model_id']}")
            print(f"   归档时间: {manifest.get('archived_at')}")

        elif args.command == "info":
            manifest = registry.get_production_model_info()
            print("=" * 60)
            print("  当前生产模型信息")
            print("=" * 60)
            print(f"  模型ID: {manifest['model_id']}")
            print(f"  模型名称: {manifest['model_name']}")
            print(f"  状态: {manifest['status']}")
            print(f"  注册时间: {manifest['registered_at']}")
            print(f"  提升时间: {manifest.get('promoted_at', 'N/A')}")

            metrics = manifest.get("metrics", {})
            if metrics:
                print(f"\n  评估指标:")
                print(f"    MAE: {metrics.get('mae', 'N/A')}")
                print(f"    MAPE: {metrics.get('mape', 'N/A')}%")
                print(f"    RMSE: {metrics.get('rmse', 'N/A')}")
                print(f"    R²: {metrics.get('r2', 'N/A')}")

            print(f"\n  特征列表:")
            for feat in manifest.get("feature_list", []):
                print(f"    - {feat}")
            print("=" * 60)

    except ModelNotFoundError as e:
        print(f"\n❌ 错误: {e}")
        exit(1)
    except ModelRegistryError as e:
        print(f"\n❌ 错误: {e}")
        exit(1)


if __name__ == "__main__":
    main()


# ==================== Backward-compatible function aliases ====================

def register_candidate_model(
    model_config: dict[str, Any],
    model_id: str,
    model_name: str,
    artifact_path: str,
    metadata_path: str,
    metrics: dict[str, float],
) -> dict[str, Any]:
    """Backward-compatible function to register a candidate model.

    This is a convenience wrapper around ModelRegistry.register_model().
    It reads the metadata from the metadata_path to get feature information.
    """
    import json

    # Read metadata to get feature_columns
    metadata = {}
    feature_list = []
    try:
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
            # Handle both feature_columns (from train_model) and feature_list keys
            feature_list = metadata.get("feature_columns", []) or metadata.get("feature_list", []) or metadata.get("features", [])
            if not feature_list:
                # Try to get from model config
                from src.data.load_data import load_config
                data_config = load_config()
                from src.features.build_features import get_feature_columns
                feature_list = get_feature_columns(data_config, model_config)["numeric"]
    except Exception:
        pass

    registry = ModelRegistry(
        model_name=model_name,
        store_dir=model_config.get("registry", {}).get("model_store_dir", "model_store"),
    )
    return registry.register_model(
        model_id=model_id,
        model_artifact_path=artifact_path,
        feature_list=feature_list,
        metrics=metrics,
        metadata=metadata,
    )


def get_production_model(model_config: dict[str, Any]) -> dict[str, Any]:
    """Backward-compatible function to get the production model info."""
    registry = ModelRegistry(
        model_name="purchase_power",
        store_dir=model_config.get("registry", {}).get("model_store_dir", "model_store"),
    )
    return registry.get_production_model_info()


def promote_model(model_config: dict[str, Any], model_id: str) -> dict[str, Any]:
    """Backward-compatible function to promote a model to production."""
    registry = ModelRegistry(
        model_name="purchase_power",
        store_dir=model_config.get("registry", {}).get("model_store_dir", "model_store"),
    )
    return registry.promote_to_production(model_id)
