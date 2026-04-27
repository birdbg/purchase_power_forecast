import http, { USE_MOCK } from './http'
import { mockPredictions } from '@/mock/mockData'
import type { PredictionRecord, PredictParams, RunPredictPayload, PredictResult } from '@/types/predict'

// 获取预测结果列表
export const getPredictionResults = async (params?: PredictParams): Promise<PredictResult> => {
  if (USE_MOCK) {
    const records: PredictionRecord[] = mockPredictions.map((item, idx) => ({
      id: `PRED-${idx}`,
      date: item.date,
      predictedValue: item.predictionValue,
      actualValue: item.actualValue,
      error: item.predictionValue - item.actualValue,
      errorRate: item.errorRate,
      modelId: `MOD-v1.2.0`,
      modelVersion: 'v1.2.0',
      status: item.errorRate < 5 ? 'success' : item.errorRate < 10 ? 'warning' : 'failed',
      createdAt: `${dayjs().subtract(29 - idx, 'day').format('YYYY-MM-DD')} 08:00:00`
    }))
    return Promise.resolve({
      total: records.length,
      success: records.filter(r => r.status === 'success').length,
      failed: records.filter(r => r.status === 'failed').length,
      avgErrorRate: records.reduce((sum, r) => sum + r.errorRate, 0) / records.length,
      resultFile: '/download/prediction_result.xlsx',
      records: records.slice(0, params?.pageSize || 20)
    })
  }
  return http.get<PredictResult>('/api/predictions', { params })
}

// 执行预测任务
export const runPrediction = async (payload: RunPredictPayload): Promise<{ success: boolean; taskId: string; message: string }> => {
  if (USE_MOCK) {
    const taskId = `PRED-TASK-${Date.now()}`
    return Promise.resolve({
      success: true,
      taskId,
      message: '预测任务提交成功，预计1分钟后完成'
    })
  }
  return http.post<{ success: boolean; taskId: string; message: string }>('/api/predictions/run', payload)
}

// 单条预测
export const singlePredict = async (payload: any): Promise<{ success: boolean; prediction: number; message: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      success: true,
      prediction: Math.random() * 1000 + 5000,
      message: '预测成功'
    })
  }
  return http.post<{ success: boolean; prediction: number; message: string }>('/api/predict', payload)
}

// 导出预测结果
export const exportPredictionResults = async (params?: PredictParams): Promise<{ downloadUrl: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      downloadUrl: '/download/prediction_result.xlsx'
    })
  }
  return http.get<{ downloadUrl: string }>('/api/predictions/export', { params, responseType: 'blob' })
}
