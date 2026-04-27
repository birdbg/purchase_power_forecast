// 预测记录类型
export interface PredictionRecord {
  id: string
  datetime: string
  predictValue: number
  actualValue?: number | null
  error?: number | null
  errorRate?: number | null
  modelVersion: string
  algorithm: 'RandomForest' | 'XGBoost' | 'LightGBM'
  status: 'normal' | 'warning' | 'abnormal'
  createdAt: string
}

export interface PredictParams {
  pageSize?: number
  page?: number
  date_start?: string
  date_end?: string
  model_version?: string
  status?: string
}

export interface RunPredictPayload {
  modelVersion?: string
  dateRange?: [string, string]
}

export interface PredictResult {
  total: number
  success: number
  failed: number
  avgErrorRate: number
  resultFile?: string
  records: PredictionRecord[]
}

// 预测请求参数
export interface PredictionRequest {
  datetime: string
  temperature: number
  humidity: number
  isWorkday: number
  month: number
  dayOfWeek: number
  hour: number
  lag_1: number
  lag_2: number
  lag_3: number
  rolling_mean_3: number
  rolling_mean_7: number
}

// 预测响应结果
export interface PredictionResponse {
  predictValue: number
  modelVersion: string
  algorithm: string
  inferenceTime: number
  timestamp: string
}

// 预测结果导出参数
export interface ExportPredictionParams {
  startDate: string
  endDate: string
  modelVersion?: string
  status?: 'normal' | 'warning' | 'abnormal'
}
