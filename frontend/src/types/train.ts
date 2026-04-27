// 训练任务状态枚举
export type TrainingJobStatus = 'pending' | 'running' | 'success' | 'failed'

// 训练任务类型
export interface TrainingJob {
  jobId: string
  modelName: string
  algorithm: 'random_forest' | 'xgboost' | 'lightgbm'
  status: TrainingJobStatus
  startTime: string
  endTime?: string | null
  progress: number
  metrics?: {
    mae: number
    mape: number
    rmse: number
    r2: number
  } | null
  params: Record<string, any>
  trainDataRange: [string, string]
  logContent?: string
  errorMessage?: string | null
  remark?: string
}

// 兼容API层命名
export type TrainJob = TrainingJob

// 创建训练任务参数
export interface CreateTrainJobPayload {
  modelName: string
  algorithm: 'random_forest' | 'xgboost' | 'lightgbm'
  trainDataStart: string
  trainDataEnd: string
  params: Record<string, any>
  remark?: string
  datasetId?: string
}

// 训练日志类型
export interface TrainLog {
  id?: number
  timestamp: string
  level: 'info' | 'warning' | 'error' | string
  content: string
}

// 训练结果类型
export interface TrainResult {
  jobId: string
  modelVersion: string
  status: TrainingJobStatus
  metrics: {
    mae: number
    mape: number
    rmse: number
    r2: number
  }
  features: string[]
  createdAt: string
}
