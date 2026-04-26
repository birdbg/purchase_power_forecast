# 外购电预测系统

本项目用于建设一个单机版"外购电预测系统"。系统基于历史外购电量、总用电量、自发电量、生产产量、天气、检修状态、节假日等数据，完成数据读取、清洗、特征工程、模型训练、模型评估、模型保存和预测结果输出。

**业务目标**：帮助企业预测未来外购电量，优化购电策略，降低用电成本。

---

## 目录结构

```
purchase_power_forecast/
├── config/                         # 配置文件
│   ├── data_config.yaml            # 数据路径、字段配置
│   └── model_config.yaml           # 模型参数配置
├── data/                           # 数据目录
│   ├── raw/                        # 原始数据（CSV/Excel）
│   ├── processed/                  # 清洗后的训练数据
│   └── prediction/                 # 待预测数据和预测结果
├── scripts/                        # 辅助脚本
│   └── generate_sample_data.py    # 生成模拟样例数据
├── src/                            # 源代码
│   ├── data/                       # 数据加载和清洗
│   │   ├── load_data.py            # 读取 CSV/Excel
│   │   └── clean_data.py           # 数据清洗
│   ├── features/                   # 特征工程
│   │   └── build_features.py      # 构造时间/滞后/滚动特征
│   ├── models/                     # 模型相关
│   │   ├── train_model.py         # 训练模型
│   │   ├── predict_model.py       # 批量预测
│   │   └── evaluate_model.py      # 模型评估
│   ├── registry/                   # 模型版本管理
│   │   └── model_registry.py     # 模型注册、发布、回滚
│   ├── service/                    # API 服务
│   │   └── api_server.py         # FastAPI 推理接口
│   └── utils/                      # 工具函数
│       └── metrics.py             # 评估指标计算
├── model_store/                    # 模型存储目录
│   └── purchase_power/            # 某模型的版本管理
│       ├── registry.json          # 版本注册表
│       └── v20260426_001/         # 具体版本
│           ├── model.joblib       # 模型文件
│           ├── manifest.json      # 模型元数据
│           ├── feature_list.json  # 特征列表
│           └── metrics.json       # 评估指标
├── outputs/                        # 输出目录
│   ├── reports/                   # 预测结果、评估报告
│   └── figures/                   # 可视化图表
├── tests/                          # 单元测试（25个测试用例）
│   ├── test_data.py
│   ├── test_features.py
│   ├── test_metrics.py
│   └── test_registry.py
├── requirements.txt
└── README.md
```

---

## 环境准备

### 1. 创建虚拟环境

在 VS Code 终端执行：

```bash
cd /Users/shiyuan/newProject/purchase_power_forecast
python3 -m venv .venv
source .venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 生成样例数据（如需）

```bash
python scripts/generate_sample_data.py
```

> ⚠️ **注意**：样例数据为模拟生成，真实项目请替换为现场实际数据。

---

## 数据字段说明

字段定义在 `config/data_config.yaml` 中：

| 字段 | 说明 | 类型 |
|------|------|------|
| `date` | 日期（YYYY-MM-DD） | datetime |
| `purchase_power` | 外购电量（目标变量） | float |
| `total_power` | 总用电量 | float |
| `self_power` | 自发电量 | float |
| `steel_output` | 钢产量 | float |
| `rolling_output` | 轧制产量 | float |
| `temperature` | 温度（℃） | float |
| `is_holiday` | 节假日标记（0/1） | int |
| `is_maintenance` | 检修标记（0/1） | int |

> 如果实际数据的字段名不同，请修改 `config/data_config.yaml` 中的配置。

---

## 快速开始

### 1. 训练模型

```bash
python -m src.models.train_model --model random_forest
```

训练完成后：
- 模型保存到 `model_store/`
- 模型状态默认为 `candidate`
- 打印训练集/测试集划分信息和评估指标

**可选算法**：`random_forest`、`xgboost`（需安装 libomp）、`lightgbm`

### 2. 查看模型版本

```bash
python -m src.registry.model_registry list
```

### 3. 发布模型为生产状态

```bash
python -m src.registry.model_registry promote v20260426_001
```

### 4. 批量预测

```bash
python -m src.models.predict_model
```

预测结果保存到：`outputs/reports/prediction_result.csv`

**预测结果示例：**
```csv
date,purchase_power,prediction_value,model_name,model_version,predict_time
2025-01-25,,579.37,random_forest,v20260426_001,2026-04-26T19:07:45.178502
2025-01-26,,879.07,random_forest,v20260426_001,2026-04-26T19:07:45.178502
```

### 5. 启动 FastAPI 服务

```bash
uvicorn src.service.api_server:app --reload --host 0.0.0.0 --port 8000
```

启动后可访问：
- `GET http://localhost:8000/health` - 健康检查
- `GET http://localhost:8000/model/current` - 当前生产模型信息
- `GET http://localhost:8000/model/list` - 所有模型版本
- `POST http://localhost:8000/model/promote/{version}` - 发布模型
- `POST http://localhost:8000/predict` - 单条预测

**预测请求示例：**
```json
{
    "date": "2025-02-01",
    "total_power": 1200.0,
    "self_power": 350.0,
    "steel_output": 800.0,
    "rolling_output": 720.0,
    "temperature": 5.0,
    "is_holiday": 0,
    "is_maintenance": 0
}
```

---

## 模型版本管理

### 状态流转

```
candidate（候选）→ production（生产）→ archived（归档）
      ↑                    ↓
      ←──── rollback ──────←
```

### CLI 命令

```bash
# 列出所有版本
python -m src.registry.model_registry list

# 查看当前生产模型
python -m src.registry.model_registry info

# 发布模型
python -m src.registry.model_registry promote v20260426_001

# 回滚模型
python -m src.registry.model_registry rollback v20260426_001
```

---

## 评估指标说明

| 指标 | 说明 | 越低越好 |
|------|------|----------|
| **MAE** | 平均绝对误差（Mean Absolute Error） | ✅ |
| **MAPE** | 平均绝对百分比误差（Mean Absolute Percentage Error）| ✅ |
| **RMSE** | 均方根误差（Root Mean Squared Error） | ✅ |
| **R²** | 决定系数（Coefficient of Determination） | ❌ 越接近1越好 |
| **Max Error** | 最大绝对误差 | ✅ |

**计算公式：**
- MAE = mean(|y_true - y_pred|)
- MAPE = mean(|(y_true - y_pred) / y_true|) × 100%
- RMSE = sqrt(mean((y_true - y_pred)²))
- R² = 1 - sum((y_true - y_pred)²) / sum((y_true - mean(y_true))²)

---

## 运行测试

```bash
# 运行所有测试
pytest

# 运行并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_metrics.py
```

**测试覆盖：**
- 数据加载和清洗
- 特征工程（时间特征、滞后特征、滚动特征）
- 评估指标计算
- 模型注册表操作

---

## 后续计划

- [ ] **LightGBM 优化**：切换到 LightGBM 提升训练速度和精度
- [ ] **Optuna 自动调参**：自动搜索最优超参数
- [ ] **SHAP 特征解释**：解释模型预测，输出特征重要性
- [ ] **数据库接入**：支持 PostgreSQL/MySQL 存储历史数据
- [ ] **前端看板**：基于 Streamlit 或 Gradio 的可视化界面

---

## 项目结构图

```
数据输入 (CSV/Excel)
      ↓
[load_data] 数据加载
      ↓
[clean_data] 数据清洗
      ↓
[build_features] 特征工程
      ↓
[train_model] 模型训练
      ↓
[model_registry] 模型注册与管理
      ↓
[predict_model] 批量预测 / [api_server] API 推理
      ↓
结果输出 (CSV / HTTP API)
```
