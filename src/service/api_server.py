"""FastAPI server for external power forecasting system.

This module provides HTTP API endpoints for:
- Health check
- Model information and management
- Single prediction requests

Run with: uvicorn src.service.api_server:app --reload
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, List, Dict

import joblib
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from src.registry.model_registry import ModelRegistry, ModelNotFoundError


# ==================== Pydantic Models ====================

class PredictInput(BaseModel):
    """Input schema for single prediction request."""

    date: str = Field(..., description="Date in YYYY-MM-DD format")
    total_power: float = Field(..., ge=0, description="Total power consumption")
    self_power: float = Field(..., ge=0, description="Self-generated power")
    steel_output: float = Field(..., ge=0, description="Steel production output")
    rolling_output: float = Field(..., ge=0, description="Rolling production output")
    temperature: float = Field(..., description="Temperature in Celsius")
    is_holiday: int = Field(..., ge=0, le=1, description="Holiday flag (0 or 1)")
    is_maintenance: int = Field(..., ge=0, le=1, description="Maintenance flag (0 or 1)")

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-02-01",
                "total_power": 1200.0,
                "self_power": 350.0,
                "steel_output": 800.0,
                "rolling_output": 720.0,
                "temperature": 5.0,
                "is_holiday": 0,
                "is_maintenance": 0,
            }
        }


class PredictOutput(BaseModel):
    """Output schema for prediction response."""

    date: str
    predicted_purchase_power: float
    model_name: str
    model_version: str
    predict_time: str


class ModelInfo(BaseModel):
    """Schema for model information."""

    model_id: str
    model_name: str
    status: str
    registered_at: str
    promoted_at: Optional[str] = None
    metrics: Optional[Dict[str, float]] = None
    feature_list: Optional[List[str]] = None


class HealthOutput(BaseModel):
    """Schema for health check response."""

    status: str
    timestamp: str
    version: str


# ==================== FastAPI App ====================

app = FastAPI(
    title="外购电预测系统 API",
    description="外购电预测系统的 HTTP API 接口",
    version="0.1.0",
)

# Global model registry instance
_registry: ModelRegistry | None = None


def get_registry() -> ModelRegistry:
    """Get or create the model registry instance."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry(model_name="purchase_power", store_dir="model_store")
    return _registry


def get_production_model() -> dict[str, Any]:
    """Load the current production model and metadata.

    Returns:
        Dictionary containing model and metadata.

    Raises:
        HTTPException: If no production model is available.
    """
    registry = get_registry()
    try:
        model_info = registry.get_production_model_info()
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到生产模型。请先训练模型并将其提升为生产状态。"
        )

    # Load model artifact
    model_data = joblib.load(model_info["artifact_path"])
    model = model_data["model"]

    return {
        "model": model,
        "model_info": model_info,
    }


# ==================== API Endpoints ====================

@app.get("/health", response_model=HealthOutput)
def health_check() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        Service status and timestamp.
    """
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0",
    }


@app.get("/model/current", response_model=ModelInfo)
def get_current_model() -> dict[str, Any]:
    """Get current production model information.

    Returns:
        Current production model details including metrics and features.

    Raises:
        HTTPException: If no production model is available.
    """
    try:
        model_info = get_registry().get_production_model_info()
        return {
            "model_id": model_info["model_id"],
            "model_name": model_info["model_name"],
            "status": model_info["status"],
            "registered_at": model_info["registered_at"],
            "promoted_at": model_info.get("promoted_at"),
            "metrics": model_info.get("metrics"),
            "feature_list": model_info.get("feature_list"),
        }
    except ModelNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@app.post("/predict", response_model=PredictOutput)
def predict(input_data: PredictInput) -> dict[str, Any]:
    """Make a single prediction using the production model.

    Args:
        input_data: Prediction input data containing business metrics.

    Returns:
        Prediction result with model version and timestamp.

    Raises:
        HTTPException: If prediction fails or no production model available.
    """
    try:
        # Load production model
        prod_data = get_production_model()
        model = prod_data["model"]
        model_info = prod_data["model_info"]
        feature_list = model_info["feature_list"]

        # Build feature vector from input
        # Calculate date-based features
        input_date = datetime.strptime(input_data.date, "%Y-%m-%d")
        weekday = input_date.weekday()
        month = input_date.month
        is_weekend = 1 if weekday >= 5 else 0

        # Build feature dict in the correct order
        features = {
            "weekday": weekday,
            "month": month,
            "is_weekend": is_weekend,
            "total_power": input_data.total_power,
            "self_power": input_data.self_power,
            "steel_output": input_data.steel_output,
            "rolling_output": input_data.rolling_output,
            "temperature": input_data.temperature,
            "is_holiday": input_data.is_holiday,
            "is_maintenance": input_data.is_maintenance,
        }

        # Add lag features (set to None for single prediction - simplified)
        # In a real scenario, you might fetch these from a database
        for lag_feat in ["purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"]:
            if lag_feat in feature_list:
                features[lag_feat] = None

        # Create DataFrame for prediction
        import pandas as pd
        df = pd.DataFrame([features])

        # Ensure column order matches training
        df = df[feature_list]

        # Make prediction
        prediction = model.predict(df)[0]

        return {
            "date": input_data.date,
            "predicted_purchase_power": round(float(prediction), 2),
            "model_name": model_info["model_name"],
            "model_version": model_info["model_id"],
            "predict_time": datetime.now().isoformat(),
        }

    except ModelNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"预测失败: {str(e)}"
        )


@app.post("/model/promote/{version}")
def promote_model(version: str) -> dict[str, Any]:
    """Promote a model version to production.

    Args:
        version: Model version ID to promote.

    Returns:
        Promotion result with updated model info.

    Raises:
        HTTPException: If model not found or promotion fails.
    """
    try:
        registry = get_registry()
        manifest = registry.promote_to_production(version)

        return {
            "success": True,
            "message": f"模型 {version} 已成功提升为生产模型",
            "model_id": manifest["model_id"],
            "promoted_at": manifest.get("promoted_at"),
        }

    except ModelNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模型不存在: {version}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模型提升失败: {str(e)}"
        )


@app.get("/model/list")
def list_models() -> dict[str, Any]:
    """List all model versions with their status.

    Returns:
        List of all registered models.
    """
    try:
        registry = get_registry()
        models = registry.list_versions()
        summary = registry.get_registry_summary()

        return {
            "total_count": len(models),
            "production_model_id": summary.get("production_model_id"),
            "models": [
                {
                    "model_id": m["model_id"],
                    "model_name": m["model_name"],
                    "status": m["status"],
                    "registered_at": m["registered_at"],
                    "mape": m.get("metrics", {}).get("mape") if m.get("metrics") else None,
                }
                for m in models
            ],
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模型列表失败: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
