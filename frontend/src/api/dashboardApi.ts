import http, { USE_MOCK } from './http'
import { mockDashboard, mockPredictions } from '@/mock/mockData'
import type { DashboardSummary, TrendData, ErrorTrendData } from '@/types/dashboard'

// 获取仪表盘汇总数据
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  if (USE_MOCK) {
    return Promise.resolve({
      currentModelVersion: mockDashboard.summary.currentModelVersion,
      currentAlgorithm: mockDashboard.summary.currentAlgorithm,
      latestMape: mockDashboard.summary.latestMape,
      todayPrediction: mockDashboard.summary.todayPrediction,
      todayErrorRate: mockDashboard.summary.todayErrorRate,
      totalModels: mockDashboard.modelVersions.length,
      runningJobs: 1,
      totalPredictions: mockPredictions.length
    })
  }
  return http.get<DashboardSummary>('/api/dashboard/summary')
}

// 获取预测趋势数据
export const getPredictionTrend = async (days = 30): Promise<TrendData[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockPredictions.slice(-days).map(item => ({
      date: item.date,
      predicted: item.predictionValue,
      actual: item.actualValue
    })))
  }
  return http.get<TrendData[]>('/api/dashboard/prediction-trend', { params: { days } })
}

// 获取误差趋势数据
export const getErrorTrend = async (days = 30): Promise<ErrorTrendData[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockPredictions.slice(-days).map(item => ({
      date: item.date,
      errorRate: item.errorRate
    })))
  }
  return http.get<ErrorTrendData[]>('/api/dashboard/error-trend', { params: { days } })
}
