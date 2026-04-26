import http, { USE_MOCK } from './http'
import { mockTrainJobs } from '@/mock/mockData'
import type { TrainJob, CreateTrainJobPayload, TrainLog, TrainResult } from '@/types/train'

// 获取训练任务列表
export const getTrainingJobs = async (): Promise<TrainJob[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockTrainJobs.map(job => ({
      id: job.jobId,
      name: job.modelName,
      algorithm: job.algorithm,
      status: job.status,
      trainDataStart: job.trainDataStart,
      trainDataEnd: job.trainDataEnd,
      startTime: job.startedAt,
      endTime: job.endedAt,
      progress: job.progress,
      mae: job.mae,
      mape: job.mape,
      rmse: job.rmse,
      r2: job.r2 || 0,
      createdBy: job.createdBy,
      dataSize: Math.floor(Math.random() * 1000) + 500
    })))
  }
  return http.get<TrainJob[]>('/api/train/jobs')
}

// 创建训练任务
export const createTrainingJob = async (payload: CreateTrainJobPayload): Promise<{ success: boolean; jobId: string; message: string }> => {
  if (USE_MOCK) {
    const jobId = `JOB${Date.now()}`
    return Promise.resolve({
      success: true,
      jobId,
      message: '训练任务创建成功，任务ID：' + jobId
    })
  }
  return http.post<{ success: boolean; jobId: string; message: string }>('/api/train/create', payload)
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
  return http.get<TrainLog[]>(`/api/train/log/${jobId}`)
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
      mae: job.mae!,
      mape: job.mape!,
      rmse: job.rmse!,
      r2: job.r2!,
      modelVersion: `v${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      modelPath: `/model_store/${jobId}`,
      featureCount: 13,
      trainTime: Math.floor(Math.random() * 600) + 300
    })
  }
  return http.get<TrainResult>(`/api/train/result/${jobId}`)
}
