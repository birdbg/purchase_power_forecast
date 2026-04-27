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
from pathlib import Path
from typing import Any, Optional, List, Dict
from uuid import uuid4
import subprocess
import shutil

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, status, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.registry.model_registry import ModelRegistry, ModelNotFoundError
from src.models.train_model import train_model
from src.models.predict_model import predict as run_batch_predict
from src.models.evaluate_model import evaluate_model


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
    purchase_lag_1: Optional[float] = Field(None, description="Previous day purchase power (lag 1)")
    purchase_lag_7: Optional[float] = Field(None, description="Purchase power 7 days ago (lag 7)")
    purchase_rolling_7: Optional[float] = Field(None, description="7-day rolling average purchase power")

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
    hasProductionModel: bool = True
    message: Optional[str] = None


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
    datasetId: Optional[str] = None
    datasetFilePath: Optional[str] = None
    rowCount: Optional[int] = None


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
    datasetId: Optional[str] = None
    datasetFilePath: Optional[str] = None
    rowCount: Optional[int] = None


class CreateTrainingJobInput(BaseModel):
    """Schema for creating training job input."""
    modelName: str = Field(default="purchase_power")
    algorithm: str = Field(default="random_forest", description="Algorithm: random_forest, xgboost, lightgbm")
    trainDataStart: Optional[str] = Field(default="2024-01-01")
    trainDataEnd: Optional[str] = Field(default="2024-12-31")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict)
    remark: Optional[str] = None
    datasetId: Optional[str] = None


class RepairDatasetInput(BaseModel):
    """Schema for repairing dataset input."""
    actions: List[str]


class ActivateDatasetInput(BaseModel):
    """Schema for activating dataset input."""
    datasetType: str = Field(description="training or prediction")


class PrepareDatasetInput(BaseModel):
    """Schema for preparing dataset input."""
    autoRepair: bool = Field(default=True)
    activate: bool = Field(default=True)


class RunPredictionInput(BaseModel):
    """Schema for running batch prediction input."""
    datasetId: Optional[str] = None
    mode: str = Field(default="last_n", description="Prediction mode: last_n or full")
    lastN: int = Field(default=7, ge=1, description="Number of last rows to use for prediction")


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

# Global training jobs storage
TRAINING_JOBS = []
TRAINING_LOGS = {}
DATASETS = []
ACTIVE_TRAINING_DATASET_ID = None
ACTIVE_PREDICTION_DATASET_ID = None

REQUIRED_DATASET_FIELDS = [
    "date", "purchase_power", "total_power", "self_power", "steel_output",
    "rolling_output", "temperature", "is_holiday", "is_maintenance"
]
NUMERIC_DATASET_FIELDS = [
    "purchase_power", "total_power", "self_power", "steel_output", "rolling_output",
    "temperature", "purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"
]
LAG_DATASET_FIELDS = ["purchase_lag_1", "purchase_lag_7", "purchase_rolling_7"]


def get_registry() -> ModelRegistry:
    """Get or create the model registry instance."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry(model_name="purchase_power", store_dir="model_store")
    return _registry


def _get_dataset(dataset_id: str) -> dict[str, Any]:
    """Return a dataset by ID or raise 404."""
    dataset = next((item for item in DATASETS if item["datasetId"] == dataset_id), None)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found"
        )
    return dataset


def _get_active_dataset(dataset_type: str) -> dict[str, Any] | None:
    """Return currently active dataset for a dataset type."""
    active_id = ACTIVE_TRAINING_DATASET_ID if dataset_type == "training" else ACTIVE_PREDICTION_DATASET_ID
    if not active_id:
        return None
    return next((item for item in DATASETS if item["datasetId"] == active_id), None)


def _read_dataset_csv(dataset: dict[str, Any]) -> pd.DataFrame:
    """Read dataset CSV from its current file path."""
    file_path = Path(dataset.get("repairedFilePath") or dataset["filePath"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file not found: {file_path}"
        )
    return pd.read_csv(file_path)


def _quality_check_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    """Run quality checks on dataset DataFrame."""
    columns = set(df.columns)
    missing_required = [field for field in REQUIRED_DATASET_FIELDS if field not in columns]
    date_missing_count = int(df["date"].isna().sum()) if "date" in df.columns else len(df)
    purchase_missing_count = int(df["purchase_power"].isna().sum()) if "purchase_power" in df.columns else len(df)

    negative_count = 0
    for field in NUMERIC_DATASET_FIELDS:
        if field in df.columns:
            values = pd.to_numeric(df[field], errors="coerce")
            negative_count += int((values < 0).sum())

    duplicate_count = int(df.duplicated(subset=["date"], keep="last").sum()) if "date" in df.columns else 0
    lag_missing_count = 0
    for field in LAG_DATASET_FIELDS:
        if field not in df.columns:
            lag_missing_count += len(df)
        else:
            lag_missing_count += int(df[field].isna().sum())

    row_count_warning = 1 if len(df) < 30 else 0
    date_range = "-"
    date_sorted = True
    date_parse_error_count = 0
    
    if "date" in df.columns:
        dates = pd.to_datetime(df["date"], errors="coerce")
        date_parse_error_count = int(dates.isna().sum())
        valid_dates = dates.dropna()
        
        if len(valid_dates) > 0:
            date_range = f"{valid_dates.min().date()} ~ {valid_dates.max().date()}"
            
            # Check if dates are sorted ascending
            if not valid_dates.is_monotonic_increasing:
                date_sorted = False

    results = [
        {
            "key": "required-fields",
            "checkItem": "必填字段存在检查",
            "result": "fail" if missing_required else "pass",
            "problemCount": len(missing_required),
            "suggestion": f"缺少字段：{', '.join(missing_required)}" if missing_required else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "date-missing",
            "checkItem": "date 缺失检查",
            "result": "fail" if date_missing_count else "pass",
            "problemCount": date_missing_count,
            "suggestion": "补充 date 或删除对应记录" if date_missing_count else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "purchase-power-missing",
            "checkItem": "purchase_power 缺失检查",
            "result": "fail" if purchase_missing_count else "pass",
            "problemCount": purchase_missing_count,
            "suggestion": "补充外购电量或删除对应记录" if purchase_missing_count else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "negative-values",
            "checkItem": "数值字段负数检查",
            "result": "fail" if negative_count else "pass",
            "problemCount": negative_count,
            "suggestion": "检查并修正负数异常值" if negative_count else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "duplicate-date",
            "checkItem": "日期重复检查",
            "result": "warning" if duplicate_count else "pass",
            "problemCount": duplicate_count,
            "suggestion": "删除重复日期记录" if duplicate_count else "无需处理",
            "fixable": duplicate_count > 0,
            "fixAction": "drop_duplicate_dates",
        },
        {
            "key": "lag-missing",
            "checkItem": "lag 字段缺失检查",
            "result": "warning" if lag_missing_count else "pass",
            "problemCount": lag_missing_count,
            "suggestion": "生成 purchase_lag_1、purchase_lag_7、purchase_rolling_7" if lag_missing_count else "无需处理",
            "fixable": "purchase_power" in df.columns and lag_missing_count > 0,
            "fixAction": "generate_lag",
        },
        {
            "key": "row-count",
            "checkItem": "数据行数检查",
            "result": "warning" if row_count_warning else "pass",
            "problemCount": row_count_warning,
            "suggestion": "训练数据少于 30 行，建议补充更多历史数据" if row_count_warning else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "date-parse",
            "checkItem": "日期格式检查",
            "result": "fail" if date_parse_error_count > 0 else "pass",
            "problemCount": date_parse_error_count,
            "suggestion": f"有 {date_parse_error_count} 条记录的日期格式无法解析" if date_parse_error_count else "无需处理",
            "fixable": False,
            "fixAction": None,
        },
        {
            "key": "date-sorted",
            "checkItem": "日期排序检查",
            "result": "warning" if not date_sorted else "pass",
            "problemCount": 0 if date_sorted else 1,
            "suggestion": "数据未按日期升序排列，训练前将自动排序" if not date_sorted else "无需处理",
            "fixable": True,
            "fixAction": "sort_dates",
        },
    ]
    missing_count = date_missing_count + purchase_missing_count + lag_missing_count
    abnormal_count = negative_count + duplicate_count
    total_problems = sum(item["problemCount"] for item in results)
    return {
        "totalProblems": total_problems,
        "results": results,
        "summary": {
            "rowCount": len(df),
            "dateRange": date_range,
            "missingCount": missing_count,
            "abnormalCount": abnormal_count,
        },
    }


def _extract_dataset_date_range(df: pd.DataFrame) -> dict[str, Any]:
    """Extract date range from dataset DataFrame."""
    if "date" not in df.columns:
        return {"dateStart": None, "dateEnd": None}
    dates = pd.to_datetime(df["date"], errors="coerce").dropna()
    if len(dates) == 0:
        return {"dateStart": None, "dateEnd": None}
    return {
        "dateStart": dates.min().strftime("%Y-%m-%d"),
        "dateEnd": dates.max().strftime("%Y-%m-%d")
    }


def _set_active_dataset(dataset: dict[str, Any], dataset_type: str) -> dict[str, Any]:
    """Set active dataset for training or prediction."""
    global ACTIVE_TRAINING_DATASET_ID, ACTIVE_PREDICTION_DATASET_ID
    if dataset_type not in {"training", "prediction"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="datasetType must be training or prediction")
    if dataset["datasetType"] != dataset_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="datasetType does not match dataset")
    for item in DATASETS:
        if item["datasetType"] == dataset_type:
            item["isActive"] = False
    dataset["isActive"] = True
    if dataset_type == "training":
        ACTIVE_TRAINING_DATASET_ID = dataset["datasetId"]
    else:
        ACTIVE_PREDICTION_DATASET_ID = dataset["datasetId"]
    return dataset


def _model_response_from_manifest(v: dict[str, Any]) -> dict[str, Any]:
    """Convert registry manifest to API model response."""
    metrics = v.get("metrics", {})
    return {
        "version": v["model_id"],
        "modelName": "purchase_power",
        "algorithm": v.get("algorithm", "unknown"),
        "status": v["status"],
        "trainDataStart": v.get("train_data_start", "-"),
        "trainDataEnd": v.get("train_data_end", "-"),
        "mae": metrics.get("mae", 0.0),
        "mape": metrics.get("mape", 0.0),
        "rmse": metrics.get("rmse", 0.0),
        "r2": metrics.get("r2", 0.0),
        "createdAt": v.get("registered_at", ""),
        "publishedAt": v.get("promoted_at"),
        "features": v.get("feature_list", []),
        "params": v.get("params", {}),
        "remark": v.get("remark", ""),
        "datasetId": v.get("datasetId"),
        "datasetFilePath": v.get("datasetFilePath"),
        "rowCount": v.get("rowCount"),
    }


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
    model_package = joblib.load(model_info["artifact_path"])
    model = model_package["model"]
    # Add features to model info
    model_info["feature_list"] = model_package.get("features", model_info.get("feature_list", []))
    model_info["algorithm"] = model_package.get("algorithm", model_info.get("model_name", "unknown"))

    return {
        "model": model,
        "model_info": model_info,
        "model_package": model_package,
    }


# ==================== Dataset Endpoints ====================

@app.post("/api/datasets/upload", summary="Upload dataset file")
async def upload_dataset(file: UploadFile = File(...), datasetType: str = Form(...)):
    """Upload CSV dataset file for training or prediction."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请上传 CSV 格式文件，Excel 请先转 CSV 或使用模板"
        )
    
    if datasetType not in {"training", "prediction"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="datasetType must be training or prediction"
        )
    
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = int(datetime.now().timestamp())
    file_name = f"{datasetType}_{timestamp}_{file.filename}"
    file_path = upload_dir / file_name
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    df = pd.read_csv(file_path)
    row_count = len(df)
    columns = list(df.columns)
    date_range = _extract_dataset_date_range(df)
    
    dataset_id = f"ds_{str(uuid4())[:8]}"
    dataset = {
        "datasetId": dataset_id,
        "datasetType": datasetType,
        "fileName": file.filename,
        "filePath": str(file_path),
        "repairedFilePath": None,
        "rowCount": row_count,
        "columns": columns,
        "dateStart": date_range["dateStart"],
        "dateEnd": date_range["dateEnd"],
        "preparedDateStart": None,
        "preparedDateEnd": None,
        "preparedFilePath": None,
        "filePathForTraining": None,
        "isPrepared": False,
        "uploadedAt": datetime.now().isoformat(),
        "qualityStatus": "unchecked",
        "qualitySummary": {
            "totalProblems": 0,
            "missingCount": 0,
            "abnormalCount": 0
        },
        "isActive": False
    }
    DATASETS.append(dataset)
    return dataset


@app.post("/api/datasets/{datasetId}/quality-check", summary="Run quality check on dataset")
def run_dataset_quality_check(datasetId: str):
    """Run quality check on uploaded dataset."""
    dataset = _get_dataset(datasetId)
    df = _read_dataset_csv(dataset)
    
    check_result = _quality_check_dataframe(df)
    if check_result["totalProblems"] == 0:
        quality_status = "passed"
    elif any(item["result"] == "fail" for item in check_result["results"]):
        quality_status = "failed"
    else:
        quality_status = "warning"
    
    dataset["qualityStatus"] = quality_status
    dataset["qualitySummary"] = {
        "totalProblems": check_result["totalProblems"],
        "missingCount": check_result["summary"]["missingCount"],
        "abnormalCount": check_result["summary"]["abnormalCount"]
    }
    
    return {
        "datasetId": datasetId,
        "totalProblems": check_result["totalProblems"],
        "results": check_result["results"],
        "summary": check_result["summary"]
    }


@app.post("/api/datasets/{datasetId}/repair", summary="Repair dataset issues")
def repair_dataset(datasetId: str, input: RepairDatasetInput):
    """Repair dataset issues with specified actions."""
    dataset = _get_dataset(datasetId)
    df = _read_dataset_csv(dataset)
    
    for action in input.actions:
        if action == "generate_lag":
            if "purchase_power" not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="generate_lag 操作需要 purchase_power 字段"
                )
            # Sort by date first to ensure correct lag/rolling calculation
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"], errors="coerce")
                df = df.sort_values("date").reset_index(drop=True)
                df["date"] = df["date"].dt.strftime("%Y-%m-%d")
            
            purchase = pd.to_numeric(df["purchase_power"], errors="coerce")
            df["purchase_lag_1"] = purchase.shift(1)
            df["purchase_lag_7"] = purchase.shift(7)
            # Shift 1 to exclude current day's data to avoid leakage
            df["purchase_rolling_7"] = purchase.shift(1).rolling(window=7, min_periods=1).mean()
        elif action == "drop_duplicate_dates":
            if "date" not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="drop_duplicate_dates 操作需要 date 字段"
                )
            df = df.drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)
        elif action == "sort_dates":
            if "date" not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="sort_dates 操作需要 date 字段"
                )
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            if df["date"].isna().any():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="存在无法解析的 date，无法排序，请先修正日期格式"
                )
            df = df.sort_values("date").reset_index(drop=True)
            df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        elif action == "fill_missing_maintenance":
            if "is_maintenance" in df.columns:
                df["is_maintenance"] = df["is_maintenance"].fillna(0).astype(int)
        elif action == "fill_missing_holiday":
            if "is_holiday" in df.columns:
                df["is_holiday"] = df["is_holiday"].fillna(0).astype(int)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的修复操作: {action}"
            )
    
    processed_dir = Path("data/processed")
    processed_dir.mkdir(parents=True, exist_ok=True)
    repaired_file_name = f"{datasetId}_repaired.csv"
    repaired_file_path = processed_dir / repaired_file_name
    df.to_csv(repaired_file_path, index=False)
    
    date_range = _extract_dataset_date_range(df)
    dataset["repairedFilePath"] = str(repaired_file_path)
    dataset["rowCount"] = len(df)
    dataset["columns"] = list(df.columns)
    dataset["dateStart"] = date_range["dateStart"]
    dataset["dateEnd"] = date_range["dateEnd"]
    
    return {
        "success": True,
        "datasetId": datasetId,
        "repairedFilePath": str(repaired_file_path),
        "message": "数据修复完成"
    }


@app.post("/api/datasets/{datasetId}/activate", summary="Set dataset as active for training/prediction")
def activate_dataset(datasetId: str, input: ActivateDatasetInput):
    """Activate dataset for training or prediction usage."""
    dataset = _get_dataset(datasetId)
    updated_dataset = _set_active_dataset(dataset, input.datasetType)
    return updated_dataset


@app.post("/api/datasets/{datasetId}/prepare", summary="Prepare dataset for training with auto repair")
def prepare_dataset(datasetId: str, input: PrepareDatasetInput):
    """Prepare dataset for training with automatic repair and feature generation."""
    dataset = _get_dataset(datasetId)
    df = _read_dataset_csv(dataset)
    
    # Validate required fields
    missing_fields = [field for field in REQUIRED_DATASET_FIELDS if field not in df.columns]
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据集缺少必填字段: {', '.join(missing_fields)}"
        )
    
    # Step 1: Sort by date
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)
    
    # Step 2: Remove duplicate dates, keep last occurrence
    df = df.drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)
    
    # Step 3: Fill missing holiday and maintenance values
    df["is_holiday"] = df["is_holiday"].fillna(0).astype(int)
    df["is_maintenance"] = df["is_maintenance"].fillna(0).astype(int)
    
    # Step 4: Convert numeric fields to proper types
    for field in NUMERIC_DATASET_FIELDS[:6]:  # Only base fields, not lag fields
        df[field] = pd.to_numeric(df[field], errors="coerce")
    
    # Step 5: Generate lag features
    purchase = df["purchase_power"]
    df["purchase_lag_1"] = purchase.shift(1)
    df["purchase_lag_7"] = purchase.shift(7)
    # Shift 1 to exclude current day's data to avoid leakage
    df["purchase_rolling_7"] = purchase.shift(1).rolling(window=7, min_periods=1).mean()
    
    # Step 6: Remove rows with missing lag values (first 7 rows)
    df = df.dropna(subset=["purchase_lag_1", "purchase_lag_7"]).reset_index(drop=True)
    
    # Update date ranges
    date_range = _extract_dataset_date_range(df)
    dataset["dateStart"] = date_range["dateStart"]
    dataset["dateEnd"] = date_range["dateEnd"]
    dataset["preparedDateStart"] = date_range["dateStart"]
    dataset["preparedDateEnd"] = date_range["dateEnd"]
    
    # Save prepared dataset
    processed_dir = Path("data/processed")
    processed_dir.mkdir(parents=True, exist_ok=True)
    prepared_file_name = f"{datasetId}_prepared.csv"
    prepared_file_path = processed_dir / prepared_file_name
    df.to_csv(prepared_file_path, index=False, date_format="%Y-%m-%d")
    
    # Update dataset metadata
    dataset["preparedFilePath"] = str(prepared_file_path)
    dataset["filePathForTraining"] = str(prepared_file_path)
    dataset["repairedFilePath"] = str(prepared_file_path)
    dataset["rowCount"] = len(df)
    dataset["columns"] = list(df.columns)
    dataset["isPrepared"] = True
    dataset["qualityStatus"] = "passed" if len(df) >= 30 else "warning"
    
    # Activate if requested
    if input.activate:
        _set_active_dataset(dataset, "training")
    
    return {
        "success": True,
        "datasetId": datasetId,
        "preparedFilePath": str(prepared_file_path),
        "rowCount": len(df),
        "columns": list(df.columns),
        "qualityStatus": dataset["qualityStatus"],
        "message": "数据准备完成, 已设为当前训练数据" if input.activate else "数据准备完成"
    }


@app.get("/api/datasets", summary="List all datasets")
def list_datasets():
    """Get list of all uploaded datasets."""
    return DATASETS


@app.get("/api/datasets/active", summary="Get active datasets")
def get_active_datasets():
    """Get currently active training and prediction datasets."""
    return {
        "training": _get_active_dataset("training"),
        "prediction": _get_active_dataset("prediction")
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


@app.post("/api/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    datasetType: str = Form(...),
) -> dict[str, Any]:
    """Upload a CSV dataset and register it for training or prediction."""
    if datasetType not in {"training", "prediction"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="datasetType must be training or prediction")
    original_name = file.filename or "dataset.csv"
    if not original_name.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="暂时只支持 CSV，请先转 CSV 或使用模板。")

    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(original_name).name.replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = upload_dir / f"{datasetType}_{timestamp}_{safe_name}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"CSV 读取失败: {str(e)}")

    dataset = {
        "datasetId": f"ds_{uuid4().hex[:10]}",
        "datasetType": datasetType,
        "fileName": original_name,
        "filePath": str(file_path),
        "repairedFilePath": None,
        "rowCount": int(len(df)),
        "columns": list(df.columns),
        "uploadedAt": datetime.now().isoformat(),
        "qualityStatus": "unchecked",
        "qualitySummary": {"totalProblems": 0, "missingCount": 0, "abnormalCount": 0},
        "isActive": False,
    }
    DATASETS.append(dataset)
    return dataset


@app.get("/api/datasets")
def list_datasets() -> list[dict[str, Any]]:
    """List uploaded datasets."""
    return DATASETS


@app.get("/api/datasets/active")
def get_active_datasets() -> dict[str, Any]:
    """Get active training and prediction datasets."""
    return {
        "training": _get_active_dataset("training"),
        "prediction": _get_active_dataset("prediction"),
    }


@app.post("/api/datasets/{dataset_id}/quality-check")
def quality_check_dataset(dataset_id: str) -> dict[str, Any]:
    """Run quality check for uploaded dataset."""
    dataset = _get_dataset(dataset_id)
    df = _read_dataset_csv(dataset)
    quality = _quality_check_dataframe(df)
    total_problems = quality["totalProblems"]
    has_fail = any(item["result"] == "fail" for item in quality["results"])
    dataset["qualityStatus"] = "passed" if total_problems == 0 else "failed" if has_fail else "warning"
    dataset["qualitySummary"] = {
        "totalProblems": total_problems,
        "missingCount": quality["summary"]["missingCount"],
        "abnormalCount": quality["summary"]["abnormalCount"],
    }
    dataset["rowCount"] = quality["summary"]["rowCount"]
    dataset["columns"] = list(df.columns)
    return {"datasetId": dataset_id, **quality}


@app.post("/api/datasets/{dataset_id}/repair")
def repair_dataset(dataset_id: str, input_data: RepairDatasetInput) -> dict[str, Any]:
    """Repair dataset with selected actions."""
    dataset = _get_dataset(dataset_id)
    df = _read_dataset_csv(dataset)
    actions = set(input_data.actions)

    if "drop_duplicate_dates" in actions and "date" in df.columns:
        df = df.drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)
    if "fill_missing_maintenance" in actions:
        if "is_maintenance" not in df.columns:
            df["is_maintenance"] = 0
        df["is_maintenance"] = df["is_maintenance"].fillna(0)
    if "fill_missing_holiday" in actions:
        if "is_holiday" not in df.columns:
            df["is_holiday"] = 0
        df["is_holiday"] = df["is_holiday"].fillna(0)
    if "generate_lag" in actions:
        if "purchase_power" not in df.columns:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="缺少 purchase_power，无法生成 lag 特征")
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            df = df.sort_values("date").reset_index(drop=True)
            df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        purchase = pd.to_numeric(df["purchase_power"], errors="coerce")
        df["purchase_lag_1"] = purchase.shift(1)
        df["purchase_lag_7"] = purchase.shift(7)
        df["purchase_rolling_7"] = purchase.shift(1).rolling(window=7, min_periods=1).mean()

    processed_dir = Path("data/processed")
    processed_dir.mkdir(parents=True, exist_ok=True)
    repaired_path = processed_dir / f"{dataset_id}_repaired.csv"
    df.to_csv(repaired_path, index=False, encoding="utf-8")
    dataset["repairedFilePath"] = str(repaired_path)
    dataset["filePath"] = str(repaired_path)
    dataset["rowCount"] = int(len(df))
    dataset["columns"] = list(df.columns)
    dataset["qualityStatus"] = "unchecked"
    return {
        "success": True,
        "datasetId": dataset_id,
        "repairedFilePath": str(repaired_path),
        "message": "数据修复完成",
    }


@app.post("/api/datasets/{dataset_id}/activate")
def activate_dataset(dataset_id: str, input_data: ActivateDatasetInput) -> dict[str, Any]:
    """Activate dataset for training or prediction."""
    dataset = _get_dataset(dataset_id)
    return _set_active_dataset(dataset, input_data.datasetType)


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
            "totalPredictions": 1245,
            "hasProductionModel": True,
            "message": None,
        }
    except Exception:
        return {
            "currentModelVersion": "-",
            "currentAlgorithm": "-",
            "latestMape": 0,
            "todayPrediction": 0,
            "todayErrorRate": 0,
            "abnormalCount": 0,
            "totalModelVersions": 0,
            "totalPredictions": 0,
            "hasProductionModel": False,
            "message": "暂无生产模型",
        }


@app.get("/api/models", response_model=List[ModelVersion])
def list_model_versions() -> List[Dict[str, Any]]:
    """List all model versions."""
    try:
        registry = get_registry()
        versions = registry.list_versions()
        result = []
        for v in versions:
            result.append(_model_response_from_manifest(v))
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model versions: {str(e)}"
        )


@app.get("/api/models/current", response_model=ModelVersion)
def get_current_production_model() -> Dict[str, Any]:
    """Get current production model information."""
    # Try to get real data first
    try:
        registry = get_registry()
        production_model = registry.get_production_model_info()
        metrics = production_model.get("metrics", {})
        
        return _model_response_from_manifest(production_model)
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No production model found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load current production model: {str(e)}"
        )


@app.get("/api/models/{version}", response_model=ModelVersion)
def get_model_version(version: str) -> Dict[str, Any]:
    """Get specific model version information."""
    # Try to get real data first
    try:
        registry = get_registry()
        model_info = registry.get_model_info(version)
        return _model_response_from_manifest(model_info)
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model version {version}: {str(e)}"
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
    try:
        registry = get_registry()
        model_info = registry.get_model_info(version)
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )

    report_path = Path(f"outputs/reports/evaluation_report_{version}.json")
    report: dict[str, Any] = {}
    if report_path.exists():
        import json
        with open(report_path, "r", encoding="utf-8") as f:
            report = json.load(f)

    metrics = report.get("metrics") or model_info.get("metrics", {})
    samples = report.get("samples", [])
    total_samples = len(samples) if samples else int(report.get("test_sample_count", 0))
    abnormal_samples = len([s for s in samples if s.get("status") == "abnormal"])
    warning_samples = len([s for s in samples if s.get("status") == "warning"])

    return {
        "modelVersion": version,
        "algorithm": model_info.get("algorithm", "unknown"),
        "trainDataRange": [model_info.get("train_data_start", "-"), model_info.get("train_data_end", "-")],
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
    
    # Get feature list from model
    feature_list = model_info.get("feature_list", [])
    if not feature_list:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="模型特征列表为空"
        )
    
    # Parse date
    date_obj = datetime.strptime(input_data.date, "%Y-%m-%d")
    
    # Create feature dictionary
    features = {}
    
    # Add time features
    features["weekday"] = date_obj.weekday()
    features["month"] = date_obj.month
    features["is_weekend"] = 1 if date_obj.weekday() >=5 else 0
    
    # Add input features
    features["temperature"] = input_data.temperature
    features["total_power"] = input_data.total_power
    features["self_power"] = input_data.self_power
    features["steel_output"] = input_data.steel_output
    features["rolling_output"] = input_data.rolling_output
    features["is_holiday"] = input_data.is_holiday
    features["is_maintenance"] = input_data.is_maintenance
    
    # Add lag features if provided
    if input_data.purchase_lag_1 is not None:
        features["purchase_lag_1"] = input_data.purchase_lag_1
    if input_data.purchase_lag_7 is not None:
        features["purchase_lag_7"] = input_data.purchase_lag_7
    if input_data.purchase_rolling_7 is not None:
        features["purchase_rolling_7"] = input_data.purchase_rolling_7
    
    # Check for missing required features
    missing_features = []
    for feature in feature_list:
        if feature not in features:
            missing_features.append(feature)
    
    if missing_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"缺少必要的特征: {', '.join(missing_features)}。请在请求中提供这些特征。"
        )
    
    # Create DataFrame for prediction and reorder to match training order
    X = pd.DataFrame([features])[feature_list]
    
    # Make prediction
    prediction = model.predict(X)[0]
    
    return {
        "date": input_data.date,
        "predicted_purchase_power": float(prediction),
        "model_name": model_info["model_name"],
        "model_version": model_info["model_id"],
        "predict_time": datetime.now().isoformat()
    }


@app.post("/api/training/run")
def run_training_job(input_data: CreateTrainingJobInput) -> dict[str, Any]:
    """Run a new training job."""
    global TRAINING_JOBS, TRAINING_LOGS
    job_id = f"job_{uuid4().hex[:8]}"
    start_time = datetime.now().isoformat()
    TRAINING_LOGS[job_id] = [
        {"timestamp": start_time, "level": "info", "content": "开始训练任务"}
    ]
    dataset = _get_dataset(input_data.datasetId) if input_data.datasetId else _get_active_dataset("training")
    if not dataset:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先上传数据集。")
    
    # Validate training date range
    ds_start = dataset.get("preparedDateStart") or dataset.get("dateStart")
    ds_end = dataset.get("preparedDateEnd") or dataset.get("dateEnd")
    
    if input_data.trainDataStart and input_data.trainDataEnd:
        train_start = datetime.strptime(input_data.trainDataStart, "%Y-%m-%d")
        train_end = datetime.strptime(input_data.trainDataEnd, "%Y-%m-%d")
        
        if train_start > train_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="训练开始日期不能晚于结束日期"
            )
        
        if ds_start and ds_end:
            ds_start_dt = datetime.strptime(ds_start, "%Y-%m-%d")
            ds_end_dt = datetime.strptime(ds_end, "%Y-%m-%d")
            
            if train_start < ds_start_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="训练开始日期超出数据集范围"
                )
            
            if train_end > ds_end_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="训练结束日期超出数据集范围"
                )
    
    # Auto prepare if not already prepared
    if not dataset.get("isPrepared", False) or not dataset.get("preparedFilePath"):
        # Run prepare steps automatically
        df = _read_dataset_csv(dataset)
        
        # Validate required fields
        missing_fields = [field for field in REQUIRED_DATASET_FIELDS if field not in df.columns]
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"数据集缺少必填字段: {', '.join(missing_fields)}"
            )
        
        # Step 1: Sort by date
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.sort_values("date").reset_index(drop=True)
        
        # Step 2: Remove duplicate dates, keep last occurrence
        df = df.drop_duplicates(subset=["date"], keep="last").reset_index(drop=True)
        
        # Step 3: Fill missing holiday and maintenance values
        df["is_holiday"] = df["is_holiday"].fillna(0).astype(int)
        df["is_maintenance"] = df["is_maintenance"].fillna(0).astype(int)
        
        # Step 4: Convert numeric fields to proper types
        for field in NUMERIC_DATASET_FIELDS[:6]:  # Only base fields, not lag fields
            df[field] = pd.to_numeric(df[field], errors="coerce")
        
        # Step 5: Generate lag features
        purchase = df["purchase_power"]
        df["purchase_lag_1"] = purchase.shift(1)
        df["purchase_lag_7"] = purchase.shift(7)
        # Shift 1 to exclude current day's data to avoid leakage
        df["purchase_rolling_7"] = purchase.shift(1).rolling(window=7, min_periods=1).mean()
        
        # Step 6: Remove rows with missing lag values (first 7 rows)
        df = df.dropna(subset=["purchase_lag_1", "purchase_lag_7"]).reset_index(drop=True)
        
        # Save prepared dataset
        processed_dir = Path("data/processed")
        processed_dir.mkdir(parents=True, exist_ok=True)
        prepared_file_name = f"{dataset['datasetId']}_prepared.csv"
        prepared_file_path = processed_dir / prepared_file_name
        df.to_csv(prepared_file_path, index=False, date_format="%Y-%m-%d")
        
        # Update dataset metadata
        dataset["preparedFilePath"] = str(prepared_file_path)
        dataset["filePathForTraining"] = str(prepared_file_path)
        dataset["repairedFilePath"] = str(prepared_file_path)
        dataset["rowCount"] = len(df)
        dataset["columns"] = list(df.columns)
        dataset["isPrepared"] = True
        dataset["qualityStatus"] = "passed" if len(df) >= 30 else "warning"
    
    # Use prepared file path first
    dataset_file_path = dataset.get("preparedFilePath") or dataset.get("filePathForTraining") or dataset.get("repairedFilePath") or dataset["filePath"]
    
    # Add job to list first
    job = {
        "jobId": job_id,
        "modelName": input_data.modelName,
        "algorithm": input_data.algorithm,
        "status": "running",
        "startTime": start_time,
        "endTime": None,
        "progress": 0.0,
        "metrics": None,
        "params": input_data.params,
        "trainDataRange": [input_data.trainDataStart, input_data.trainDataEnd],
        "errorMessage": None,
        "remark": input_data.remark,
        "datasetId": dataset["datasetId"],
        "datasetFilePath": dataset_file_path,
        "rowCount": dataset.get("rowCount", 0),
    }
    TRAINING_JOBS.append(job)
    
    try:
        # Run training
        model_version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        TRAINING_LOGS[job_id].append({"timestamp": datetime.now().isoformat(), "level": "info", "content": f"生成模型版本: {model_version}"})
        job["progress"] = 30.0
        
        # Select config based on model name
        if input_data.modelName == "cold_rolling":
            data_config_path = "config/data_config_cold_rolling.yaml"
            model_config_path = "config/model_config_cold_rolling.yaml"
        else:
            data_config_path = "config/data_config.yaml"
            model_config_path = "config/model_config.yaml"

        if not Path(dataset_file_path).exists():
            raise FileNotFoundError(
                f"Raw data file not found: {dataset_file_path}. 请先在数据管理页面上传/准备训练数据。"
            )
              
        result = train_model(
            data_path=dataset_file_path,
            data_config_path=data_config_path,
            model_config_path=model_config_path,
            model_name=input_data.algorithm,
            train_data_start=input_data.trainDataStart,
            train_data_end=input_data.trainDataEnd,
            save_splits=True,
            extra_metadata={
                "datasetId": dataset["datasetId"],
                "datasetFilePath": dataset_file_path,
                "rowCount": dataset.get("rowCount", 0),
            },
        )
        
        job["progress"] = 100.0
        job["status"] = "success"
        job["endTime"] = datetime.now().isoformat()
        job["metrics"] = result.get("metrics", {})
        job["modelVersion"] = result.get("model_id", model_version)
        job["trainSampleCount"] = result.get("train_sample_count", len(X_train) if 'X_train' in locals() else 0)
        job["testSampleCount"] = result.get("test_sample_count", len(X_test) if 'X_test' in locals() else 0)
        job["featureDatasetPath"] = result.get("feature_dataset_path", "")
        job["trainDatasetPath"] = result.get("train_dataset_path", "")
        job["testDatasetPath"] = result.get("test_dataset_path", "")
        TRAINING_LOGS[job_id].append({"timestamp": datetime.now().isoformat(), "level": "info", "content": "训练完成"})
        
        return {
            "success": True,
            "jobId": job_id,
            "modelVersion": job["modelVersion"],
            "algorithm": input_data.algorithm,
            "metrics": job["metrics"],
            "status": "success",
            "message": f"训练完成，模型版本: {model_version}"
        }
    except FileNotFoundError as e:
        job["status"] = "failed"
        job["endTime"] = datetime.now().isoformat()
        job["errorMessage"] = str(e)
        TRAINING_LOGS[job_id].append({"timestamp": datetime.now().isoformat(), "level": "error", "content": str(e)})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        job["status"] = "failed"
        job["endTime"] = datetime.now().isoformat()
        job["errorMessage"] = str(e)
        TRAINING_LOGS[job_id].append({"timestamp": datetime.now().isoformat(), "level": "error", "content": f"训练失败: {str(e)}"})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"训练任务失败: {str(e)}"
        )


@app.get("/api/training/jobs", response_model=List[TrainingJob])
def list_training_jobs() -> List[Dict[str, Any]]:
    """List all training jobs."""
    global TRAINING_JOBS
    return TRAINING_JOBS


@app.get("/api/training/jobs/{job_id}", response_model=TrainingJob)
def get_training_job(job_id: str) -> Dict[str, Any]:
    """Get training job details by ID."""
    global TRAINING_JOBS
    for job in TRAINING_JOBS:
        if job["jobId"] == job_id:
            return job

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Training job {job_id} not found"
    )


@app.get("/api/training/jobs/{job_id}/log")
def get_training_job_logs(job_id: str) -> List[Dict[str, Any]]:
    """Get training job logs by ID."""
    global TRAINING_LOGS
    if job_id not in TRAINING_LOGS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training job {job_id} logs not found"
        )
    return TRAINING_LOGS[job_id]


@app.post("/api/predictions/run")
def run_batch_prediction(input_data: Optional[RunPredictionInput] = None) -> dict[str, Any]:
    """Run batch prediction task with simplified last_n mode for MVP."""
    try:
        input_data = input_data or RunPredictionInput()
        dataset_id = input_data.datasetId
        dataset = _get_dataset(dataset_id) if dataset_id else _get_active_dataset("training")
        if not dataset:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先上传并激活训练数据集。")
        
        # Use prepared file path first
        dataset_file_path = dataset.get("preparedFilePath") or dataset.get("repairedFilePath") or dataset["filePath"]
        if not Path(dataset_file_path).exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset file not found: {dataset_file_path}")
        
        # Handle last_n mode: take last N rows from dataset
        if input_data.mode == "last_n":
            df = pd.read_csv(dataset_file_path)
            last_n_rows = df.tail(input_data.lastN).copy()
            
            # Save temporary file for prediction
            temp_dir = Path("data/temp")
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file_path = temp_dir / f"prediction_last_{input_data.lastN}.csv"
            last_n_rows.to_csv(temp_file_path, index=False)
            
            # Run prediction on the last N rows
            result = run_batch_predict(data_path=str(temp_file_path), output_path="outputs/reports/prediction_result.csv")
            sample_count = len(last_n_rows)
        else:
            # Full dataset mode
            result = run_batch_predict(data_path=dataset_file_path, output_path="outputs/reports/prediction_result.csv")
            sample_count = result.get("sample_count", 0)
        
        output_path = result.get("output_path", "outputs/reports/prediction_result.csv")
        model_version = result.get("model_id", result.get("model_version", "unknown"))
        
        return {
            "success": True,
            "datasetId": dataset["datasetId"],
            "datasetFilePath": dataset_file_path,
            "outputPath": output_path,
            "sampleCount": sample_count,
            "modelVersion": model_version,
            "modelName": "purchase_power",
            "predictTime": datetime.now().isoformat(),
            "message": f"批量预测完成，共生成 {sample_count} 条预测记录"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"预测任务失败: {str(e)}"
        )


@app.get("/api/predictions", response_model=List[PredictionRecord])
def get_prediction_records(
    date_start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    date_end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    model_version: Optional[str] = Query(None, description="Filter by model version"),
    status: Optional[str] = Query(None, description="Filter by status")
) -> List[Dict[str, Any]]:
    """Get prediction records with optional filters."""
    try:
        pred_file = Path("outputs/reports/prediction_result.csv")
        if pred_file.exists():
            df = pd.read_csv(pred_file)
            predictions = []
            
            for idx, row in df.iterrows():
                actual = row.get("purchase_power")
                predict_val = row.get("prediction_value", row.get("prediction", row.get("predicted_purchase_power", 0)))
                actual = None if pd.isna(actual) else actual
                error = abs(predict_val - actual) if actual is not None else None
                error_rate = round(error / actual * 100, 2) if actual is not None and actual > 0 else None
                
                # Determine status
                if actual is None:
                    record_status = "pending"
                elif error_rate > 10:
                    record_status = "abnormal"
                elif error_rate > 5:
                    record_status = "warning"
                else:
                    record_status = "normal"
                
                predictions.append({
                    "id": f"pred_{idx}",
                    "datetime": row.get("date", row.get("datetime", datetime.now().isoformat())),
                    "predictValue": float(predict_val),
                    "actualValue": float(actual) if actual is not None else None,
                    "error": float(error) if error is not None else None,
                    "errorRate": error_rate,
                    "modelVersion": row.get("model_version", "unknown"),
                    "algorithm": row.get("algorithm", "RandomForest"),
                    "status": record_status,
                    "createdAt": row.get("predict_time", datetime.now().isoformat())
                })
            
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
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to load predictions: {str(e)}")

    return []


@app.post("/api/evaluation/{version}/run")
def run_model_evaluation(version: str) -> dict[str, Any]:
    """Run model evaluation for a specific version."""
    try:
        # Handle current version
        if version == "current":
            registry = get_registry()
            production_model = registry.get_production_model_info()
            version = production_model["model_id"]
        
        # Run evaluation
        result = evaluate_model(version=version)
        metrics = result.get("metrics", {})
        report_path = f"outputs/reports/evaluation_report_{version}.json"
        registry = get_registry()
        model_info = registry.get_model_info(version)
        samples: list[dict[str, Any]] = []

        return {
            "success": True,
            "result": {
                "modelVersion": version,
                "algorithm": result.get("algorithm", model_info.get("algorithm", "unknown")),
                "trainDataRange": [model_info.get("train_data_start", "-"), model_info.get("train_data_end", "-")],
                "metrics": metrics,
                "samples": samples,
                "totalSamples": int(result.get("test_sample_count", 0)),
                "abnormalSamples": 0,
                "warningSamples": 0,
            },
            "reportPath": report_path,
            "message": "评估完成"
        }
    except ModelNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model version {version} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"评估任务失败: {str(e)}"
        )
        
