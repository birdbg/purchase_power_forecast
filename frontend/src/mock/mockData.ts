import dayjs from 'dayjs'

// 1. 仪表盘汇总数据
export const dashboardSummary = {
  currentModelVersion: 'v1.2.0',
  currentAlgorithm: 'RandomForest',
  latestMape: 4.2,
  todayPrediction: 1452.6,
  todayErrorRate: 3.8
}

// 2. 最近30天预测趋势数据
const generatePredictionTrendData = () => {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('MM-DD')
    const baseValue = 1200 + Math.random() * 400
    const actualValue = Math.round(baseValue * 10) / 10
    const error = (Math.random() - 0.5) * 150
    const predictionValue = Math.round((actualValue + error) * 10) / 10
    const errorRate = Math.round(Math.abs(error / actualValue * 100) * 100) / 100
    
    data.push({
      date,
      predictionValue,
      actualValue,
      errorRate
    })
  }
  return data
}
export const predictionTrendData = generatePredictionTrendData()

// 3. 模型版本数据
export const modelVersions = [
  {
    version: 'v1.2.0',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'production',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-03-31',
    mae: 56.8,
    mape: 4.2,
    rmse: 72.5,
    r2: 0.927,
    createdAt: '2026-04-26 10:35:00',
    publishedAt: '2026-04-26 11:00:00',
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 400, max_depth: 10, min_samples_leaf: 2, random_state: 42 },
    remark: '当前生产环境模型，效果最优'
  },
  {
    version: 'v1.1.1',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    status: 'staging',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-03-31',
    mae: 62.3,
    mape: 4.8,
    rmse: 78.1,
    r2: 0.918,
    createdAt: '2026-04-26 11:20:00',
    publishedAt: null,
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 500, max_depth: 6, learning_rate: 0.05, subsample: 0.9 },
    remark: '待发布候选模型，XGBoost优化版'
  },
  {
    version: 'v1.1.0',
    modelName: '外购电预测模型',
    algorithm: 'LightGBM',
    status: 'candidate',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-02-28',
    mae: 68.5,
    mape: 5.6,
    rmse: 85.3,
    r2: 0.905,
    createdAt: '2026-04-25 16:10:00',
    publishedAt: null,
    createdBy: 'operator',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 500, learning_rate: 0.05, num_leaves: 31, subsample: 0.9 },
    remark: 'LightGBM基础版本，效果略差'
  },
  {
    version: 'v1.0.0',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'archived',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2025-12-31',
    mae: 78.2,
    mape: 7.3,
    rmse: 98.6,
    r2: 0.876,
    createdAt: '2026-04-20 09:30:00',
    publishedAt: '2026-04-20 10:00:00',
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance'],
    params: { n_estimators: 300, max_depth: 8, min_samples_leaf: 3 },
    remark: '旧版本已归档，特征较少'
  },
  {
    version: 'v0.9.0',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    status: 'rejected',
    trainDataStart: '2021-06-01',
    trainDataEnd: '2025-12-31',
    mae: 95.6,
    mape: 11.2,
    rmse: 120.5,
    r2: 0.812,
    createdAt: '2026-04-18 14:20:00',
    publishedAt: null,
    createdBy: 'operator',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output'],
    params: { n_estimators: 400, max_depth: 5 },
    remark: '误差过大，拒绝上线，特征缺失严重'
  }
]

// 4. 训练任务数据
export const trainingJobs = [
  {
    jobId: 'JOB20260426001',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    status: 'running',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-04-25',
    startedAt: '2026-04-26 13:30:00',
    endedAt: null,
    progress: 65,
    mae: null,
    mape: null,
    rmse: null,
    createdBy: 'admin',
    logs: [
      '[2026-04-26 13:30:00] 开始加载训练数据',
      '[2026-04-26 13:32:15] 数据预处理完成，共1932条训练样本',
      '[2026-04-26 13:35:42] 特征工程完成，共13个特征',
      '[2026-04-26 13:40:10] 开始训练XGBoost模型，n_estimators=500',
      '[2026-04-26 13:45:33] 训练进度65%，当前验证MAPE=5.1%'
    ]
  },
  {
    jobId: 'JOB20260426002',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'success',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-03-31',
    startedAt: '2026-04-26 10:00:00',
    endedAt: '2026-04-26 10:35:00',
    progress: 100,
    mae: 56.8,
    mape: 4.2,
    rmse: 72.5,
    r2: 0.927,
    createdBy: 'admin',
    logs: [
      '[2026-04-26 10:00:00] 开始加载训练数据',
      '[2026-04-26 10:02:12] 数据预处理完成，共1928条训练样本',
      '[2026-04-26 10:05:30] 特征工程完成，共13个特征',
      '[2026-04-26 10:10:05] 开始训练RandomForest模型，n_estimators=400',
      '[2026-04-26 10:32:18] 模型训练完成',
      '[2026-04-26 10:34:45] 模型评估完成，MAPE=4.2%',
      '[2026-04-26 10:35:00] 任务完成，模型已保存'
    ]
  },
  {
    jobId: 'JOB20260425001',
    modelName: '外购电预测模型',
    algorithm: 'LightGBM',
    status: 'failed',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2026-02-28',
    startedAt: '2026-04-25 15:00:00',
    endedAt: '2026-04-25 15:12:30',
    progress: 30,
    mae: null,
    mape: null,
    rmse: null,
    createdBy: 'operator',
    logs: [
      '[2026-04-25 15:00:00] 开始加载训练数据',
      '[2026-04-25 15:03:22] 数据预处理完成，共1886条训练样本',
      '[2026-04-25 15:06:15] 开始特征工程',
      '[2026-04-25 15:12:28] ERROR: 特征`rolling_output`存在238条缺失值，无法继续训练',
      '[2026-04-25 15:12:30] 任务失败，请检查数据质量'
    ]
  },
  {
    jobId: 'JOB20260420001',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'success',
    trainDataStart: '2021-01-01',
    trainDataEnd: '2025-12-31',
    startedAt: '2026-04-20 09:00:00',
    endedAt: '2026-04-20 09:30:00',
    progress: 100,
    mae: 78.2,
    mape: 7.3,
    rmse: 98.6,
    r2: 0.876,
    createdBy: 'admin',
    logs: [
      '[2026-04-20 09:00:00] 开始加载训练数据',
      '[2026-04-20 09:02:45] 数据预处理完成，共1826条训练样本',
      '[2026-04-20 09:05:10] 特征工程完成，共10个特征',
      '[2026-04-20 09:10:05] 开始训练RandomForest模型，n_estimators=300',
      '[2026-04-20 09:27:18] 模型训练完成',
      '[2026-04-20 09:29:20] 模型评估完成，MAPE=7.3%',
      '[2026-04-20 09:30:00] 任务完成，模型已保存'
    ]
  }
]

// 5. 评估样本数据（误差最大的前10条）
export const evaluationSamples = [
  {
    date: '2026-04-25',
    predictionValue: 1526.8,
    actualValue: 1716.1,
    errorValue: -189.3,
    errorRate: 11.03,
    scenario: '高负荷',
    possibleReason: '临时增产计划未纳入特征'
  },
  {
    date: '2026-04-20',
    predictionValue: 982.5,
    actualValue: 1128.3,
    errorValue: -145.8,
    errorRate: 12.92,
    scenario: '节假日',
    possibleReason: '假期补班未识别'
  },
  {
    date: '2026-04-18',
    predictionValue: 1382.6,
    actualValue: 1253.2,
    errorValue: 129.4,
    errorRate: 10.33,
    scenario: '检修',
    possibleReason: '设备检修提前结束，用电高于预期'
  },
  {
    date: '2026-04-15',
    predictionValue: 1452.1,
    actualValue: 1568.7,
    errorValue: -116.6,
    errorRate: 7.43,
    scenario: '高负荷',
    possibleReason: '订单超预期，生产负荷高于历史同期'
  },
  {
    date: '2026-04-12',
    predictionValue: 1123.5,
    actualValue: 1225.8,
    errorValue: -102.3,
    errorRate: 8.35,
    scenario: '正常生产',
    possibleReason: '气温突变，制冷用电增加'
  },
  {
    date: '2026-04-10',
    predictionValue: 1082.6,
    actualValue: 986.4,
    errorValue: 96.2,
    errorRate: 9.75,
    scenario: '检修',
    possibleReason: '临时安排设备检修，生产用电低于预期'
  },
  {
    date: '2026-04-08',
    predictionValue: 1526.3,
    actualValue: 1602.5,
    errorValue: -76.2,
    errorRate: 4.75,
    scenario: '高负荷',
    possibleReason: '正常波动'
  },
  {
    date: '2026-04-05',
    predictionValue: 852.6,
    actualValue: 912.3,
    errorValue: -59.7,
    errorRate: 6.54,
    scenario: '节假日',
    possibleReason: '部分岗位值班，实际用电高于预期'
  },
  {
    date: '2026-04-03',
    predictionValue: 1326.8,
    actualValue: 1278.5,
    errorValue: 48.3,
    errorRate: 3.78,
    scenario: '正常生产',
    possibleReason: '正常波动'
  },
  {
    date: '2026-04-01',
    predictionValue: 1426.9,
    actualValue: 1472.3,
    errorValue: -45.4,
    errorRate: 3.08,
    scenario: '正常生产',
    possibleReason: '正常波动'
  }
]

// 兼容API层的导出别名
export const mockModels = modelVersions
export const mockTrainJobs = trainingJobs
export const mockPredictions = predictionTrendData
export const mockDashboard = {
  summary: dashboardSummary,
  trend: predictionTrendData,
  modelVersions: modelVersions.slice(0, 3)
}
