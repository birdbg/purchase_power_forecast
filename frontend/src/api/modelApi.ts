import http, { USE_MOCK } from './http'
import { mockModels } from '@/mock/mockData'
import type { ModelVersion } from '@/types/model'

// 获取模型列表
export const getModelList = async (): Promise<ModelVersion[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockModels.map(m => ({
      version: m.version,
      modelName: m.modelName,
      algorithm: m.algorithm as ModelVersion['algorithm'],
      status: m.status as ModelVersion['status'],
      trainDataStart: m.trainDataStart,
      trainDataEnd: m.trainDataEnd,
      mae: m.mae,
      mape: m.mape,
      rmse: m.rmse,
      r2: m.r2,
      createdAt: m.createdAt,
      publishedAt: m.publishedAt,
      features: m.features,
      params: m.params,
      remark: m.remark
    })))
  }
  return http.get<any, ModelVersion[]>('/api/models')
}

// 获取当前生产模型
export const getCurrentModel = async (): Promise<ModelVersion> => {
  if (USE_MOCK) {
    const productionModel = mockModels.find(m => m.status === 'production')!
    return Promise.resolve({
      version: productionModel.version,
      modelName: productionModel.modelName,
      algorithm: productionModel.algorithm as ModelVersion['algorithm'],
      status: productionModel.status as ModelVersion['status'],
      trainDataStart: productionModel.trainDataStart,
      trainDataEnd: productionModel.trainDataEnd,
      mae: productionModel.mae,
      mape: productionModel.mape,
      rmse: productionModel.rmse,
      r2: productionModel.r2,
      createdAt: productionModel.createdAt,
      publishedAt: productionModel.publishedAt,
      features: productionModel.features,
      params: productionModel.params,
      remark: productionModel.remark
    })
  }
  return http.get<any, ModelVersion>('/api/models/current')
}

// 发布模型为生产版本
export const promoteModel = async (version: string): Promise<{ success: boolean; message: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      success: true,
      message: `模型${version}发布成功`
    })
  }
  return http.post<any, { success: boolean; message: string }>(`/api/models/${version}/promote`)
}

// 回滚到指定版本
export const rollbackModel = async (version: string): Promise<{ success: boolean; message: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      success: true,
      message: `已回滚到模型版本${version}`
    })
  }
  return http.post<any, { success: boolean; message: string }>(`/api/models/${version}/rollback`)
}

// 获取模型详情
export const getModelDetail = async (version: string): Promise<ModelVersion> => {
  if (USE_MOCK) {
    const model = mockModels.find(m => m.version === version)!
    return Promise.resolve({
      version: model.version,
      modelName: model.modelName,
      algorithm: model.algorithm as ModelVersion['algorithm'],
      status: model.status as ModelVersion['status'],
      trainDataStart: model.trainDataStart,
      trainDataEnd: model.trainDataEnd,
      mae: model.mae,
      mape: model.mape,
      rmse: model.rmse,
      r2: model.r2,
      createdAt: model.createdAt,
      publishedAt: model.publishedAt,
      features: model.features,
      params: model.params,
      remark: model.remark
    })
  }
  return http.get<any, ModelVersion>(`/api/models/${version}`)
}
