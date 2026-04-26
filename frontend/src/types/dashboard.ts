// 仪表盘统计汇总类型
export interface DashboardSummary {
  totalPredictions: number
  averageMape: number
  totalModelVersions: number
  currentProductionModel: string
  predictionAccuracy: number
  dataCoverage: number
  lastPredictionTime: string
  nextScheduledTraining: string
}

// 预测趋势数据点
export interface PredictionTrendPoint {
  datetime: string
  predictValue: number
  actualValue: number
}

// 误差趋势数据点
export interface ErrorTrendPoint {
  datetime: string
  errorRate: number
  threshold: number
}

// 模型版本误差对比数据
export interface ModelVersionError {
  version: string
  averageMape: number
  totalPredictions: number
  status: 'production' | 'staging' | 'archived'
}

// 评估样本数据
export interface EvaluationSample {
  id: string
  datetime: string
  predictValue: number
  actualValue: number
  error: number
  errorRate: number
  modelVersion: string
  status: 'normal' | 'warning' | 'abnormal'
}

// 兼容API层和组件命名
export type TrendData = PredictionTrendPoint
export type ErrorTrendData = ErrorTrendPoint
export type TrendItem = PredictionTrendPoint
