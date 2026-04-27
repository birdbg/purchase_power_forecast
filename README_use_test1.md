# test1(1).xlsx 转换说明

这个包把你上传的测试 Excel 转成当前外购电预测程序可直接使用的目录结构。

## 数据切分

- 训练数据：前 83 行，2026-01-01 至 2026-03-24。
- 预测数据：最后 7 行，2026-03-25 至 2026-03-31。
- 真实对照：最后 7 行真实“实际用电量”，保存在 outputs/reports/test1_truth_last7.csv。

## 字段映射

原始 Excel 字段：
- 日期 -> date
- 实际用电量 -> purchase_power（作为本次预测目标）
- 实际产量 -> steel_output / rolling_output
- total_power -> 暂用实际产量作为代理特征
- self_power -> 原始数据没有该字段，填 0
- temperature -> 原始数据没有天气，填 20
- is_holiday / is_maintenance -> 原始数据没有，填 0

## 文件说明

- data/raw/sample_power_data.csv
  - 用于训练模型，包含 83 行历史数据。
- data/prediction/predict_input.csv
  - 用于预测最后 7 天的实际用电量，purchase_power 已置空。
  - 已补齐 purchase_lag_1、purchase_lag_7、purchase_rolling_7。
- outputs/reports/test1_truth_last7.csv
  - 最后 7 天真实值，用于和 prediction_result.csv 对比。

## 使用方式

在项目根目录执行：

```bash
unzip test1_program_data.zip -d .
python -m src.models.train_model --model random_forest
python -m src.registry.model_registry list
python -m src.registry.model_registry promote <生成的版本号>
python -m src.models.predict_model
python -m src.models.evaluate_model
```

注意：
当前程序仍叫 purchase_power，这是字段名复用；这次实际含义是“实际用电量”。
由于原始 Excel 只有产量和用电量，total_power、self_power、temperature 等字段是为了适配现有程序结构而补齐的占位/代理字段。正式建模时建议把 model_config.yaml 的 features 调整为实际可获得字段。