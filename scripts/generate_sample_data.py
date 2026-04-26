#!/usr/bin/env python3
"""
外购电预测系统 - 样例数据生成脚本
生成符合业务逻辑的模拟数据，用于开发和测试

⚠️ 注意：这是模拟数据，真实项目需要替换为现场实际采集的数据
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# 设置随机种子保证可复现
np.random.seed(42)
random.seed(42)

# 生成日期范围：约5个月的日级数据
start_date = datetime(2024, 9, 1)
end_date = datetime(2025, 1, 31)
date_range = pd.date_range(start=start_date, end=end_date, freq='D')

n_days = len(date_range)
print(f"生成 {n_days} 天的样例数据...")

# 初始化数据容器
data = {
    'date': date_range,
    'purchase_power': np.zeros(n_days),
    'total_power': np.zeros(n_days),
    'self_power': np.zeros(n_days),
    'steel_output': np.zeros(n_days),
    'rolling_output': np.zeros(n_days),
    'temperature': np.zeros(n_days),
    'is_holiday': np.zeros(n_days),
    'is_maintenance': np.zeros(n_days),
}

# 定义中国主要节假日（2024年9月 - 2025年1月）
holidays = [
    # 中秋节 2024
    '2024-09-15', '2024-09-16', '2024-09-17',
    # 国庆节 2024
    '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', 
    '2024-10-05', '2024-10-06', '2024-10-07',
    # 元旦 2025
    '2025-01-01',
]
holidays_set = set(pd.to_datetime(holidays))

# 生成基础业务数据
for i, date in enumerate(date_range):
    weekday = date.weekday()  # 0=Monday, 6=Sunday
    
    # 判断是否节假日
    is_holiday = 1 if date in holidays_set else 0
    
    # 判断是否周末
    is_weekend = 1 if weekday >= 5 else 0
    
    # 判断是否检修日（约5%的概率检修，排除节假日）
    is_maintenance = 1 if (not is_holiday and random.random() < 0.05) else 0
    
    # 基础产量（受周末和节假日影响）
    if is_holiday:
        base_output_factor = random.uniform(0.1, 0.3)  # 节假日产量很低
    elif is_weekend:
        base_output_factor = random.uniform(0.5, 0.7)  # 周末产量较低
    else:
        base_output_factor = random.uniform(0.7, 1.0)  # 工作日产量正常
    
    # 检修日产量进一步降低
    if is_maintenance:
        base_output_factor *= random.uniform(0.4, 0.6)
    
    # 产量生成（钢产量和轧制产量有相关性）
    base_steel = random.uniform(800, 1200)
    base_rolling = base_steel * random.uniform(0.85, 0.95)
    
    steel_output = base_steel * base_output_factor + random.uniform(-50, 50)
    rolling_output = base_rolling * base_output_factor + random.uniform(-30, 30)
    
    steel_output = max(0, steel_output)
    rolling_output = max(0, rolling_output)
    
    # 温度（季节性变化，9月还热，1月较冷）
    # 用傅里叶项模拟季节性温度
    day_of_year = date.timetuple().tm_yday
    seasonal_temp = 15 * np.sin(2 * np.pi * (day_of_year - 80) / 365) + 10
    temperature = seasonal_temp + random.uniform(-5, 5)
    
    # 总用电量（与产量正相关，温度也有影响）
    # 基础用电量与产量相关
    total_power_base = steel_output * 0.8 + rolling_output * 0.6
    
    # 温度影响：温度极端时用电量增加（制冷/制热）
    temp_effect = abs(temperature - 20) * 10 if temperature < 10 or temperature > 25 else 0
    
    # 检修日用电量降低
    maint_effect = 0.7 if is_maintenance else 1.0
    
    total_power = total_power_base * maint_effect + temp_effect + random.uniform(-100, 100)
    total_power = max(500, total_power)
    
    # 自发电量（相对稳定，有小幅波动）
    self_power = random.uniform(300, 500) * (1 + (temperature - 15) * 0.01)
    self_power = max(200, min(600, self_power))
    
    # 外购电量 = 总用电量 - 自发电量，加上随机波动
    purchase_power = total_power - self_power
    # 加入一定的随机波动（±10%）
    fluctuation = random.uniform(-0.1, 0.1)
    purchase_power = purchase_power * (1 + fluctuation)
    purchase_power = max(100, purchase_power)
    
    # 存储数据
    data['total_power'][i] = round(total_power, 2)
    data['self_power'][i] = round(self_power, 2)
    data['purchase_power'][i] = round(purchase_power, 2)
    data['steel_output'][i] = round(steel_output, 2)
    data['rolling_output'][i] = round(rolling_output, 2)
    data['temperature'][i] = round(temperature, 1)
    data['is_holiday'][i] = is_holiday
    data['is_maintenance'][i] = is_maintenance

# 创建 DataFrame
df = pd.DataFrame(data)

# 数据质量检查
print("\n=== 数据质量检查 ===")
print(f"数据行数: {len(df)}")
print(f"日期范围: {df['date'].min()} ~ {df['date'].max()}")
print(f"\n各字段统计:")
print(df.describe())

print(f"\n节假日天数: {df['is_holiday'].sum()}")
print(f"检修天数: {df['is_maintenance'].sum()}")

# 业务逻辑验证
print("\n=== 业务逻辑验证 ===")
# 验证 purchase_power ≈ total_power - self_power
df['calc_purchase'] = df['total_power'] - df['self_power']
df['diff_ratio'] = abs(df['purchase_power'] - df['calc_purchase']) / df['calc_purchase']
print(f"外购电量偏差均值: {df['diff_ratio'].mean():.2%}")

# 清理临时列
df = df.drop(columns=['calc_purchase', 'diff_ratio'])

# 保存到 CSV
output_path = 'data/raw/sample_power_data.csv'
df.to_csv(output_path, index=False, date_format='%Y-%m-%d')

# 同时生成 prediction 目录下的待预测数据模板
predict_df = df.tail(7).copy()
predict_df['purchase_power'] = np.nan  # 待预测的目标值
predict_input_path = 'data/prediction/predict_input.csv'
predict_df.to_csv(predict_input_path, index=False, date_format='%Y-%m-%d')
print(f"✅ 待预测数据模板已保存至: {predict_input_path}")

print("\n⚠️ 注意：以上数据均为模拟生成，真实项目需替换为现场实际数据")
