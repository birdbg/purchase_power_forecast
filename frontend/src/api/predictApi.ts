import http, { USE_MOCK } from './http'
import { mockPredictions } from '@/mock/mockData'
import type { PredictionRecord, PredictParams, RunPredictPayload, PredictResult } from '@/types/predict'
import dayjs from 'dayjs'

// 获取预测结果列表
export const getPredictionResults = async (params?: PredictParams): Promise<PredictResult> => {
  if (USE_MOCK) {
    const records: PredictionRecord[] = mockPredictions.map((item, idx) => ({
      id: `PRED-${idx}`,
      datetime: item.date,
      predictValue: item.predictionValue,
      actualValue: item.actualValue,
      error: item.predictionValue - item.actualValue,
      errorRate: item.errorRate,
      modelVersion: 'v1.2.0',
      algorithm: 'RandomForest',
      status: item.errorRate < 5 ? 'normal' : item.errorRate < 10 ? 'warning' : 'abnormal',
      createdAt: `${dayjs().subtract(29 - idx, 'day').format('YYYY-MM-DD')} 08:00:00`
    }))
    return Promise.resolve({
      total: records.length,
      success: records.filter(r => r.status === 'normal').length,
      failed: records.filter(r => r.status === 'abnormal').length,
      avgErrorRate: records.reduce((sum, r) => sum + (r.errorRate || 0), 0) / records.length,
      resultFile: '/download/prediction_result.xlsx',
      records: records.slice(0, params?.pageSize || 20)
    })
  }
  const records = await http.get<any, PredictionRecord[]>('/api/predictions', { params })
  return {
    total: records.length,
    success: records.filter(record => record.status === 'normal').length,
    failed: records.filter(record => record.status === 'abnormal').length,
    avgErrorRate: records.length > 0
      ? records.reduce((sum, record) => sum + (record.errorRate || 0), 0) / records.length
      : 0,
    records
  }
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
  return http.post<any, { success: boolean; taskId: string; message: string }>('/api/predictions/run', payload)
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
  return http.post<any, { success: boolean; prediction: number; message: string }>('/api/predict', payload)
}

// 导出预测结果
export const exportPredictionResults = async (params?: PredictParams): Promise<{ downloadUrl: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      downloadUrl: '/download/prediction_result.xlsx'
    })
  }
  return http.get<any, { downloadUrl: string }>('/api/predictions/export', { params, responseType: 'blob' })
}
