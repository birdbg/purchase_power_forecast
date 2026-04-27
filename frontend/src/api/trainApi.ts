import http, { USE_MOCK } from './http'
import { mockTrainJobs } from '@/mock/mockData'
import type { TrainJob, CreateTrainJobPayload, TrainLog, TrainResult } from '@/types/train'

// 获取训练任务列表
export const getTrainingJobs = async (): Promise<TrainJob[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockTrainJobs.map(job => ({
      jobId: job.jobId,
      modelName: job.modelName,
      algorithm: job.algorithm === 'RandomForest' ? 'random_forest' : job.algorithm === 'XGBoost' ? 'xgboost' : 'lightgbm',
      status: job.status as TrainJob['status'],
      startTime: job.startedAt,
      endTime: job.endedAt,
      progress: job.progress,
      metrics: job.mae || job.mape || job.rmse || job.r2 ? {
        mae: job.mae || 0,
        mape: job.mape || 0,
        rmse: job.rmse || 0,
        r2: job.r2 || 0
      } : null,
      params: {},
      trainDataRange: [job.trainDataStart, job.trainDataEnd] as [string, string],
      remark: ''
    })))
  }
  return http.get<any, TrainJob[]>('/api/training/jobs')
}

export interface CreateTrainingJobResponse {
  success: boolean
  jobId: string
  modelVersion?: string
  algorithm?: string
  metrics?: {
    mae?: number
    mape?: number
    rmse?: number
    r2?: number
    max_error?: number
  }
  status: 'running' | 'success' | 'failed'
  message: string
  datasetId?: string
  trainSampleCount?: number
  testSampleCount?: number
  featureDatasetPath?: string
  trainDatasetPath?: string
  testDatasetPath?: string
}

// 创建训练任务
export const createTrainingJob = async (payload: CreateTrainJobPayload): Promise<CreateTrainingJobResponse> => {
  if (USE_MOCK) {
    const jobId = `JOB${Date.now()}`
    return Promise.resolve({
      success: true,
      jobId,
      modelVersion: `v${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}_${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')}`,
      algorithm: payload.algorithm,
      metrics: {
        mae: 10 + Math.random() * 20,
        mape: 3 + Math.random() * 5,
        rmse: 12 + Math.random() * 20,
        r2: 0.8 + Math.random() * 0.19
      },
      status: 'success',
      message: '训练任务创建成功，任务ID：' + jobId
    })
  }
  return http.post<any, CreateTrainingJobResponse>('/api/training/run', payload)
}

// 获取训练日志
export const getTrainingLog = async (jobId: string): Promise<TrainLog[]> => {
  if (USE_MOCK) {
    const job = mockTrainJobs.find(j => j.jobId === jobId)
    return Promise.resolve(job?.logs.map((log, idx) => ({
      id: idx + 1,
      timestamp: log.substring(1, 20),
      level: log.includes('ERROR') ? 'error' : 'info',
      content: log.substring(22)
    })) || [])
  }
  return http.get<any, TrainLog[]>(`/api/training/jobs/${jobId}/log`)
}

// 获取训练结果
export const getTrainingResult = async (jobId: string): Promise<TrainResult | null> => {
  if (USE_MOCK) {
    const job = mockTrainJobs.find(j => j.jobId === jobId)
    if (!job || job.status !== 'success') {
      return Promise.resolve(null)
    }
    return Promise.resolve({
      jobId,
      modelVersion: `v${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      status: job.status as TrainResult['status'],
      metrics: {
        mae: job.mae || 0,
        mape: job.mape || 0,
        rmse: job.rmse || 0,
        r2: job.r2 || 0
      },
      features: [],
      createdAt: job.endedAt || job.startedAt
    })
  }
  return http.get<any, TrainResult>(`/api/training/jobs/${jobId}`)
}
