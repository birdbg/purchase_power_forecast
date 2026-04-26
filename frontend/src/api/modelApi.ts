import http, { USE_MOCK } from './http'
import { mockModels } from '@/mock/mockData'
import type { ModelVersion } from '@/types/model'

// 获取模型列表
export const getModelList = async (): Promise<ModelVersion[]> => {
  if (USE_MOCK) {
    return Promise.resolve(mockModels.map(m => ({
      id: `MOD-${m.version}`,
      version: m.version,
      name: m.modelName,
      algorithm: m.algorithm,
      status: m.status,
      trainDataStart: m.trainDataStart,
      trainDataEnd: m.trainDataEnd,
      mae: m.mae,
      mape: m.mape,
      rmse: m.rmse,
      r2: m.r2,
      createTime: m.createdAt,
      publishTime: m.publishedAt,
      createdBy: m.createdBy,
      features: m.features,
      params: m.params,
      remark: m.remark
    })))
  }
  return http.get<ModelVersion[]>('/api/model/list')
}

// 获取当前生产模型
export const getCurrentModel = async (): Promise<ModelVersion> => {
  if (USE_MOCK) {
    const productionModel = mockModels.find(m => m.status === 'production')!
    return Promise.resolve({
      id: `MOD-${productionModel.version}`,
      version: productionModel.version,
      name: productionModel.modelName,
      algorithm: productionModel.algorithm,
      status: productionModel.status,
      trainDataStart: productionModel.trainDataStart,
      trainDataEnd: productionModel.trainDataEnd,
      mae: productionModel.mae,
      mape: productionModel.mape,
      rmse: productionModel.rmse,
      r2: productionModel.r2,
      createTime: productionModel.createdAt,
      publishTime: productionModel.publishedAt,
      createdBy: productionModel.createdBy,
      features: productionModel.features,
      params: productionModel.params,
      remark: productionModel.remark
    })
  }
  return http.get<ModelVersion>('/api/model/current')
}

// 发布模型为生产版本
export const promoteModel = async (version: string): Promise<{ success: boolean; message: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      success: true,
      message: `模型${version}发布成功`
    })
  }
  return http.post(`/api/model/promote/${version}`)
}

// 回滚到指定版本
export const rollbackModel = async (version: string): Promise<{ success: boolean; message: string }> => {
  if (USE_MOCK) {
    return Promise.resolve({
      success: true,
      message: `已回滚到模型版本${version}`
    })
  }
  return http.post(`/api/model/rollback/${version}`)
}

// 获取模型详情
export const getModelDetail = async (version: string): Promise<ModelVersion> => {
  if (USE_MOCK) {
    const model = mockModels.find(m => m.version === version)!
    return Promise.resolve({
      id: `MOD-${model.version}`,
      version: model.version,
      name: model.modelName,
      algorithm: model.algorithm,
      status: model.status,
      trainDataStart: model.trainDataStart,
      trainDataEnd: model.trainDataEnd,
      mae: model.mae,
      mape: model.mape,
      rmse: model.rmse,
      r2: model.r2,
      createTime: model.createdAt,
      publishTime: model.publishedAt,
      createdBy: model.createdBy,
      features: model.features,
      params: model.params,
      remark: model.remark
    })
  }
  return http.get<ModelVersion>(`/api/model/detail/${version}`)
}
