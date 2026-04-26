"""FastAPI server for external power forecasting system.

This module provides HTTP API endpoints for:
- Health check
- Model information and management
- Single prediction requests
- Dashboard statistics
- Model evaluation
- Training job management

Run with: uvicorn src.service.api_server:app --reload
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional, List, Dict
from uuid import uuid4

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
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
    algorithm: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class HealthOutput(BaseModel):
    """Schema for health check response."""

    status: str
    timestamp: str
    version: str


class DashboardSummaryOutput(BaseModel):
    """Schema for dashboard summary response."""
    currentModelVersion: str
    currentAlgorithm: str
    latestMape: float
    todayPrediction: float
    todayErrorRate: float
    abnormalCount: int
    totalModelVersions: int
    totalPredictions: int


class ModelVersion(BaseModel):
    """Schema for model version list item."""
    version: str
    modelName: str
    algorithm: str
    status: str
    trainDataStart: str
    trainDataEnd: str
    mae: float
    mape: float
    rmse: float
    r2: float
    createdAt: str
    publishedAt: Optional[str] = None
    features: List[str]
    params: Dict[str, Any]
    remark: Optional[str] = None


class EvaluationSample(BaseModel):
    """Schema for model evaluation sample."""
    id: str
    datetime: str
    predictValue: float
    actualValue: float
    error: float
    errorRate: float
    modelVersion: str
    status: str


class EvaluationOutput(BaseModel):
    """Schema for model evaluation response."""
    modelVersion: str
    algorithm: str
    trainDataRange: List[str]
    metrics: Dict[str, float]
    samples: List[EvaluationSample]
    totalSamples: int
    abnormalSamples: int
    warningSamples: int


class PredictionRecord(BaseModel):
    """Schema for prediction record."""
    id: str
    datetime: str
    predictValue: float
    actualValue: Optional[float] = None
    error: Optional[float] = None
    errorRate: Optional[float] = None
    modelVersion: str
    algorithm: str
    status: str
    createdAt: str


class TrainingJob(BaseModel):
    """Schema for training job."""
    jobId: str
    modelName: str
    algorithm: str
    status: str
    startTime: str
    endTime: Optional[str] = None
    progress: float
    metrics: Optional[Dict[str, float]] = None
    params: Dict[str, Any]
    trainDataRange: List[str]
    errorMessage: Optional[str] = None
    remark: Optional[str] = None


class CreateTrainingJobInput(BaseModel):
    """Schema for creating training job input."""
    modelName: str = Field(default="purchase_power")
    algorithm: str = Field(default="RandomForest")
    trainDataStart: str
    trainDataEnd: str
    params: Optional[Dict[str, Any]] = Field(default_factory=dict)
    remark: Optional[str] = None


class CreateTrainingJobOutput(BaseModel):
    """Schema for creating training job response."""
    success: bool
    jobId: str
    message: str


# ==================== FastAPI App ====================

app = FastAPI(
    title="外购电预测系统 API",
    description="外购电预测系统的 HTTP API 接口",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# ==================== Mock Data Utilities ====================

def get_mock_model_versions() -> List[Dict[str, Any]]:
    """Generate mock model version data if real models don't exist."""
    return [
        {
            "version": "v2.1.0",
            "modelName": "purchase_power",
            "algorithm": "RandomForest",
            "status": "production",
            "trainDataStart": "2024-01-01",
            "trainDataEnd": "2024-12-31",
            "mae": 12.34,
            "mape": 4.21,
            "rmse": 18.56,
            "r2": 0.94,
            "createdAt": "2024-12-15T10:30:00",
            "publishedAt": "2024-12-20T14:15:00",
            "features": ["weekday", "month", "temperature", "total_power", "self_power", "steel_output"],
            "params": {"n_estimators": 100, "max_depth": 10},
            "remark": "Production model with best performance"
        },
        {
            "version": "v2.0.0",
            "modelName": "purchase_power",
            "algorithm": "XGBoost",
            "status": "staging",
            "trainDataStart": "2024-01-01",
            "trainDataEnd": "2024-12-31",
            "mae": 13.56,
            "mape": 4.87,
            "rmse": 20.12,
            "r2": 0.93,
            "createdAt": "2024-12-10T09:20:00",
            "publishedAt": None,
            "features": ["weekday", "month", "temperature", "total_power", "self_power", "steel_output"],
            "params": {"n_estimators": 200, "max_depth": 8},
            "remark": "Staging candidate model"
        },
        {
            "version": "v1.9.0",
            "modelName": "purchase_power",
            "algorithm": "RandomForest",
            "status": "archived",
            "trainDataStart": "2023-01-01",
            "trainDataEnd": "2023-12-31",
            "mae": 15.78,
            "mape": 5.67,
            "rmse": 22.34,
            "r2": 0.91,
            "createdAt": "2023-12-20T11:45:00",
            "publishedAt": "2023-12-25T16:30:00",
            "features": ["weekday", "month", "temperature", "total_power", "self_power"],
            "params": {"n_estimators": 100, "max_depth": 8},
            "remark": "Previous production model, archived"
        },
        {
            "version": "v1.8.0",
            "modelName": "purchase_power",
            "algorithm": "LightGBM",
            "status": "rejected",
            "trainDataStart": "2023-01-01",
            "trainDataEnd": "2023-12-31",
            "mae": 18.9,
            "mape": 7.23,
            "rmse": 25.67,
            "r2": 0.89,
            "createdAt": "2023-11-15T14:20:00",
            "publishedAt": None,
            "features": ["weekday", "month", "temperature", "total_power"],
            "params": {"n_estimators": 150, "max_depth": 6},
            "remark": "Performance too low, rejected"
        }
    ]


def get_mock_evaluation_samples(model_version: str) -> List[Dict[str, Any]]:
    """Generate mock evaluation samples."""
    samples = []
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(100):
        date = base_date + timedelta(days=i)
        actual = 800 + (i % 30) * 10 + (i % 7) * 5
        predict = actual + (-5 if i % 3 == 0 else 10 if i % 7 == 0 else 2)
        error = abs(predict - actual)
        error_rate = round(error / actual * 100, 2)
        
        if error_rate > 10:
            status = "abnormal"
        elif error_rate > 5:
            status = "warning"
        else:
            status = "normal"
            
        samples.append({
            "id": f"sample_{i}",
            "datetime": date.isoformat(),
            "predictValue": round(predict, 2),
            "actualValue": round(actual, 2),
            "error": round(error, 2),
            "errorRate": error_rate,
            "modelVersion": model_version,
            "status": status
        })
    
    return samples


def get_mock_predictions() -> List[Dict[str, Any]]:
    """Generate mock prediction records."""
    predictions = []
    base_date = datetime.now() - timedelta(days=90)
    
    for i in range(90):
        date = base_date + timedelta(days=i)
        actual = 800 + (i % 30) * 10 + (i % 7) * 5 if date < datetime.now() else None
        predict = actual + (-5 if i % 3 == 0 else 10 if i % 7 == 0 else 2) if actual else 850 + (i % 10) * 5
        error = abs(predict - actual) if actual else None
        error_rate = round(error / actual * 100, 2) if actual else None
        
        if error_rate and error_rate > 10:
            status = "abnormal"
        elif error_rate and error_rate > 5:
            status = "warning"
        else:
            status = "normal" if actual else "pending"
            
        predictions.append({
            "id": f"pred_{i}",
            "datetime": date.isoformat(),
            "predictValue": round(predict, 2),
            "actualValue": round(actual, 2) if actual else None,
            "error": round(error, 2) if error else None,
            "errorRate": error_rate,
            "modelVersion": "v2.1.0" if i < 45 else "v2.0.0",
            "algorithm": "RandomForest" if i < 45 else "XGBoost",
            "status": status,
            "createdAt": date.isoformat()
        })
    
    return predictions


def get_mock_training_jobs() -> List[Dict[str, Any]]:
    """Generate mock training jobs."""
    now = datetime.now()
    return [
        {
            "jobId": "job_001",
            "modelName": "purchase_power",
            "algorithm": "RandomForest",
            "status": "running",
            "startTime": (now - timedelta(minutes=15)).isoformat(),
            "endTime": None,
            "progress": 65.0,
            "metrics": None,
            "params": {"n_estimators": 150, "max_depth": 10, "random_state": 42},
            "trainDataRange": ["2024-01-01", "2024-12-31"],
            "errorMessage": None,
            "remark": "New model training with updated features"
        },
        {
            "jobId": "job_002",
            "modelName": "purchase_power",
            "algorithm": "XGBoost",
            "status": "success",
            "startTime": (now - timedelta(hours=2)).isoformat(),
            "endTime": (now - timedelta(hours=1, minutes=20)).isoformat(),
            "progress": 100.0,
            "metrics": {"mae": 13.45, "mape": 4.67, "rmse": 19.23, "r2": 0.935},
            "params": {"n_estimators": 200, "max_depth": 8, "learning_rate": 0.1},
            "trainDataRange": ["2024-01-01", "2024-12-31"],
            "errorMessage": None,
            "remark": "XGBoost baseline model"
        },
        {
            "jobId": "job_003",
            "modelName": "purchase_power",
            "algorithm": "LightGBM",
            "status": "failed",
            "startTime": (now - timedelta(hours=3)).isoformat(),
            "endTime": (now - timedelta(hours=2, minutes=45)).isoformat(),
            "progress": 30.0,
            "metrics": None,
            "params": {"n_estimators": 150, "max_depth": 7},
            "trainDataRange": ["2024-01-01", "2024-12-31"],
            "errorMessage": "Memory overflow during training",
            "remark": "LightGBM experiment failed"
        }
    ]


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


@app.get("/api/dashboard/summary", response_model=DashboardSummaryOutput)
def get_dashboard_summary() -> dict[str, Any]:
    """Get dashboard summary statistics."""
    # Try to get real data first
    try:
        registry = get_registry()
        production_model = registry.get_production_model_info()
        versions = registry.list_versions()
        
        return {
            "currentModelVersion": production_model["model_id"],
            "currentAlgorithm": production_model.get("algorithm", "RandomForest"),
            "latestMape": production_model.get("metrics", {}).get("mape", 4.21),
            "todayPrediction": 895.67,
            "todayErrorRate": 3.89,
            "abnormalCount": 3,
            "totalModelVersions": len(versions),
            "totalPredictions": 1245
        }
    except Exception:
        # Fallback to mock data
        return {
            "currentModelVersion": "v2.1.0",
            "currentAlgorithm": "RandomForest",
            "latestMape": 4.21,
            "todayPrediction": 895.67,
            "todayErrorRate": 3.89,
            "abnormalCount": 3,
            "totalModelVersions": 4,
            "totalPredictions": 1245
        }


@app.get("/api/models", response_model=List[ModelVersion])
def list_model_versions() -> List[Dict[str, Any]]:
    """List all model versions."""
    # Try to get real data first
    try:
        registry = get_registry()
        versions = registry.list_versions()
        if versions:
            result = []
            for v in versions:
                metrics = v.get("metrics", {})
                result.append({
                    "version": v["model_id"],
                    "modelName": "purchase_power",
                    "algorithm": v.get("algorithm", "RandomForest"),
                    "status": v["status"],
                    "trainDataStart": v.get("train_data_start", "2024-01-01"),
                    "trainDataEnd": v.get("train_data_end", "2024-12-31"),
                    "mae": metrics.get("mae", 0.0),
                    "mape": metrics.get("mape", 0.0),
                    "rmse": metrics.get("rmse", 0.0),
                    "r2": metrics.get("r2", 0.0),
                    "createdAt": v["registered_at"],
                    "publishedAt": v.get("promoted_at"),
                    "features": v.get("feature_list", []),
                    "params": v.get("params", {}),
                    "remark": v.get("remark", "")
                })
            return result
    except Exception:
        pass
    
    # Fallback to mock data
    return get_mock_model_versions()


@app.get("/api/models/current", response_model=ModelVersion)
def get_current_production_model() -> Dict[str, Any]:
    """Get current production model information."""
    # Try to get real data first
    try:
        registry = get_registry()
        production_model = registry.get_production_model_info()
        metrics = production_model.get("metrics", {})
        
        return {
            "version": production_model["model_id"],
            "modelName": "purchase_power",
            "algorithm": production_model.get("algorithm", "RandomForest"),
            "status": production_model["status"],
            "trainDataStart": production_model.get("train_data_start", "2024-01-01"),
            "trainDataEnd": production_model.get("train_data_end", "2024-12-31"),
            "mae": metrics.get("mae", 0.0),
            "mape": metrics.get("mape", 0.0),
            "rmse": metrics.get("rmse", 0.0),
            "r2": metrics.get("r2", 0.0),
            "createdAt": production_model["registered_at"],
            "publishedAt": production_model.get("promoted_at"),
            "features": production_model.get("feature_list", []),
            "params": production_model.get("params", {}),
            "remark": production_model.get("remark", "")
        }
    except Exception:
        # Fallback to mock data
        mock_versions = get_mock_model_versions()
        for v in mock_versions:
            if v["status"] == "production":
                return v
        return mock_versions[0]


@app.get("/api/models/{version}", response_model=ModelVersion)
def get_model_version(version: str) -> Dict[str, Any]:
    """Get specific model version information."""
    # Try to get real data first
    try:
        registry = get_registry()
        model_info = registry.get_model_info(version)
        metrics = model_info.get("metrics", {})
        
        return {
            "version": model_info["model_id"],
            "modelName": "purchase_power",
            "algorithm": model_info.get("algorithm", "RandomForest"),
            "status": model_info["status"],
            "trainDataStart": model_info.get("train_data_start", "2024-01-01"),
            "trainDataEnd": model_info.get("train_data_end", "2024-12-31"),
            "mae": metrics.get("mae", 0.0),
            "mape": metrics.get("mape", 0.0),
            "rmse": metrics.get("rmse", 0.0),
            "r2": metrics.get("r2", 0.0),
            "createdAt": model_info["registered_at"],
            "publishedAt": model_info.get("promoted_at"),
            "features": model_info.get("feature_list", []),
            "params": model_info.get("params", {}),
            "remark": model_info.get("remark", "")
        }
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )
    except Exception:
        # Fallback to mock data
        mock_versions = get_mock_model_versions()
        for v in mock_versions:
            if v["version"] == version:
                return v
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )


@app.post("/api/models/{version}/promote")
def promote_model_version(version: str) -> dict[str, Any]:
    """Promote a model version to production."""
    try:
        registry = get_registry()
        result = registry.promote_to_production(version)
        return {
            "success": True,
            "message": f"Model {version} successfully promoted to production",
            "model": result
        }
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to promote model: {str(e)}"
        )


@app.post("/api/models/{version}/rollback")
def rollback_model_version(version: str) -> dict[str, Any]:
    """Rollback to a previous model version."""
    try:
        registry = get_registry()
        result = registry.rollback(version)
        return {
            "success": True,
            "message": f"Successfully rolled back to model {version}",
            "model": result
        }
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rollback model: {str(e)}"
        )


@app.get("/api/evaluation/{version}", response_model=EvaluationOutput)
def get_model_evaluation(version: str) -> Dict[str, Any]:
    """Get evaluation results for a specific model version."""
    # Get mock evaluation samples
    samples = get_mock_evaluation_samples(version)
    
    # Calculate statistics
    total_samples = len(samples)
    abnormal_samples = len([s for s in samples if s["status"] == "abnormal"])
    warning_samples = len([s for s in samples if s["status"] == "warning"])
    
    # Try to get real model info first
    try:
        registry = get_registry()
        model_info = registry.get_model_info(version)
        metrics = model_info.get("metrics", {
            "mae": 12.34,
            "mape": 4.21,
            "rmse": 18.56,
            "r2": 0.94
        })
        train_data_start = model_info.get("train_data_start", "2024-01-01")
        train_data_end = model_info.get("train_data_end", "2024-12-31")
        algorithm = model_info.get("algorithm", "RandomForest")
    except Exception:
        # Fallback to mock data
        metrics = {
            "mae": 12.34,
            "mape": 4.21,
            "rmse": 18.56,
            "r2": 0.94
        }
        train_data_start = "2024-01-01"
        train_data_end = "2024-12-31"
        algorithm = "RandomForest"
    
    return {
        "modelVersion": version,
        "algorithm": algorithm,
        "trainDataRange": [train_data_start, train_data_end],
        "metrics": metrics,
        "samples": samples,
        "totalSamples": total_samples,
        "abnormalSamples": abnormal_samples,
        "warningSamples": warning_samples
    }


@app.get("/api/predictions", response_model=List[PredictionRecord])
def get_prediction_records(
    date_start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    date_end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    model_version: Optional[str] = Query(None, description="Filter by model version"),
    status: Optional[str] = Query(None, description="Filter by status")
) -> List[Dict[str, Any]]:
    """Get prediction records with optional filters."""
    predictions = get_mock_predictions()
    
    # Apply filters
    if date_start:
        predictions = [p for p in predictions if p["datetime"] >= date_start]
    if date_end:
        predictions = [p for p in predictions if p["datetime"] <= date_end]
    if model_version:
        predictions = [p for p in predictions if p["modelVersion"] == model_version]
    if status:
        predictions = [p for p in predictions if p["status"] == status]
    
    return predictions


@app.get("/api/training/jobs", response_model=List[TrainingJob])
def list_training_jobs() -> List[Dict[str, Any]]:
    """List all training jobs."""
    # For now return mock data
    return get_mock_training_jobs()


@app.post("/api/training/jobs", response_model=CreateTrainingJobOutput)
def create_training_job(input_data: CreateTrainingJobInput) -> dict[str, Any]:
    """Create a new training job."""
    # Generate mock job ID
    job_id = f"job_{uuid4().hex[:8]}"
    
    # In a real implementation, this would queue the training job
    # For now just return success
    return {
        "success": True,
        "jobId": job_id,
        "message": f"Training job {job_id} created successfully"
    }


@app.post("/api/predict", response_model=PredictOutput)
def predict(input_data: PredictInput) -> dict[str, Any]:
    """Make a single prediction using the production model."""
    model_data = get_production_model()
    model = model_data["model"]
    model_info = model_data["model_info"]
    
    # Prepare features
    feature_list = model_info.get("feature_list", [
        "weekday", "month", "temperature", "total_power",
        "self_power", "steel_output", "rolling_output",
        "is_holiday", "is_maintenance"
    ])
    
    # Parse date
    date_obj = datetime.strptime(input_data.date, "%Y-%m-%d")
    
    # Create feature dictionary
    features = {
        "weekday": date_obj.weekday(),
        "month": date_obj.month,
        "temperature": input_data.temperature,
        "total_power": input_data.total_power,
        "self_power": input_data.self_power,
        "steel_output": input_data.steel_output,
        "rolling_output": input_data.rolling_output,
        "is_holiday": input_data.is_holiday,
        "is_maintenance": input_data.is_maintenance
    }
    
    # Create DataFrame for prediction
    X = pd.DataFrame([features])
    
    # Make prediction
    prediction = model.predict(X[feature_list])[0]
    
    return {
        "date": input_data.date,
        "predicted_purchase_power": float(prediction),
        "model_name": model_info["model_name"],
        "model_version": model_info["model_id"],
        "predict_time": datetime.now().isoformat()
    }
