#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动调参模块测试用例
"""
import os
import json
import sys
import tempfile
from pathlib import Path
import pytest
import pandas as pd

from src.models.tune_model import load_and_prepare_data, create_model_with_params
from src.registry.model_registry import ModelRegistry
from src.data.load_data import load_config


def test_load_and_prepare_data():
    """测试数据加载和准备功能"""
    model_config = load_config("config/model_config.yaml")
    data_config = load_config("config/data_config.yaml")
    
    X_train, y_train, X_valid, y_valid, feature_cols = load_and_prepare_data(model_config, data_config)
    
    assert len(X_train) > 0
    assert len(y_train) == len(X_train)
    assert len(X_valid) > 0
    assert len(y_valid) == len(X_valid)
    assert len(feature_cols) == len(model_config["features"])


def test_create_model_with_params():
    """测试模型创建功能"""
    # 测试random_forest
    params = {"n_estimators": 100, "max_depth": 5}
    model = create_model_with_params("random_forest", params)
    assert model is not None
    assert hasattr(model, "fit")
    assert hasattr(model, "predict")


def test_tune_command_basic():
    """测试基础调参命令，运行2个trials，验证输出文件生成"""
    # 运行调参命令
    exit_code = os.system(f"{sys.executable} -m src.models.tune_model --model random_forest --n-trials 2")
    assert exit_code == 0, "调参命令执行失败"
    
    # 查找生成的输出文件
    output_dir = Path("outputs/reports/")
    trial_files = list(output_dir.glob("tuning_trials_random_forest_*.csv"))
    result_files = list(output_dir.glob("tuning_result_random_forest_*.json"))
    
    assert len(trial_files) >= 1, "未生成trials明细文件"
    assert len(result_files) >= 1, "未生成调参结果文件"
    
    # 验证文件内容
    trials_df = pd.read_csv(trial_files[-1])
    assert len(trials_df) == 2, "trials数量不对"
    assert "value" in trials_df.columns
    assert "params_n_estimators" in trials_df.columns
    
    with open(result_files[-1], "r", encoding="utf-8") as f:
        result = json.load(f)
    assert "best_params" in result
    assert "metrics" in result
    assert "best_value" in result
    assert result["model_name"] == "random_forest"
    assert result["n_trials"] == 2


def test_tune_command_train_final():
    """测试带--train-final参数的调参命令，验证模型注册"""
    # 先清理现有模型
    model_store_dir = Path("model_store/")
    if model_store_dir.exists():
        for f in model_store_dir.rglob("*"):
            if f.is_file():
                f.unlink()
    
    # 运行带train-final的调参命令
    exit_code = os.system(f"{sys.executable} -m src.models.tune_model --model random_forest --n-trials 2 --train-final")
    assert exit_code == 0, "带train-final的调参命令执行失败"
    
    # 验证模型已注册
    registry = ModelRegistry()
    versions = registry.list_versions()
    assert len(versions) >= 1, "模型未注册成功"
    
    # 验证模型metadata包含调参信息
    latest_model = versions[-1]
    assert latest_model["status"] == "candidate"
    assert latest_model["algorithm"] == "random_forest"
    assert latest_model.get("tuned") == True
    assert "tuning_trials" in latest_model
    assert latest_model["tuning_trials"] == 2
    assert "tuning_best_value" in latest_model
    assert "tuning_result_path" in latest_model


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
