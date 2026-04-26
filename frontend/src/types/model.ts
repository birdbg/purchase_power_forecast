// 模型状态枚举
export type ModelStatus = 'production' | 'staging' | 'candidate' | 'archived' | 'rejected'

// 算法类型枚举
export type AlgorithmType = 'RandomForest' | 'XGBoost' | 'LightGBM'

// 模型版本类型
export interface ModelVersion {
  version: string
  modelName: string
  algorithm: AlgorithmType
  status: ModelStatus
  trainDataStart: string
  trainDataEnd: string
  mae: number
  mape: number
  rmse: number
  r2: number
  createdAt: string
  publishedAt?: string | null
  features: string[]
  params: Record<string, any>
  remark?: string
}
