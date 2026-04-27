import http from './http'

export interface DatasetInfo {
  datasetId: string
  datasetType: 'training' | 'prediction'
  fileName: string
  filePath: string
  repairedFilePath?: string | null
  rowCount: number
  columns: string[]
  uploadedAt: string
  qualityStatus: 'unchecked' | 'passed' | 'warning' | 'failed'
  qualitySummary: {
    totalProblems: number
    missingCount: number
    abnormalCount: number
  }
  isActive: boolean
}

export interface QualityCheckResult {
  key: string
  checkItem: string
  result: 'pass' | 'warning' | 'fail'
  problemCount: number
  suggestion: string
  fixable: boolean
  fixAction: 'generate_lag' | 'drop_duplicate_dates' | 'fill_missing_maintenance' | 'fill_missing_holiday' | null
}

export interface DatasetQualityResponse {
  datasetId: string
  totalProblems: number
  results: QualityCheckResult[]
  summary: {
    rowCount: number
    dateRange: string
    missingCount: number
    abnormalCount: number
  }
}

export const uploadDataset = async (file: File, datasetType: 'training' | 'prediction'): Promise<DatasetInfo> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('datasetType', datasetType)
  return http.post<any, DatasetInfo>('/api/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getDatasets = async (): Promise<DatasetInfo[]> => {
  return http.get<any, DatasetInfo[]>('/api/datasets')
}

export const getActiveDatasets = async (): Promise<{ training: DatasetInfo | null; prediction: DatasetInfo | null }> => {
  return http.get<any, { training: DatasetInfo | null; prediction: DatasetInfo | null }>('/api/datasets/active')
}

export const qualityCheckDataset = async (datasetId: string): Promise<DatasetQualityResponse> => {
  return http.post<any, DatasetQualityResponse>(`/api/datasets/${datasetId}/quality-check`)
}

export const repairDataset = async (datasetId: string, actions: string[]): Promise<{ success: boolean; datasetId: string; repairedFilePath: string; message: string }> => {
  return http.post<any, { success: boolean; datasetId: string; repairedFilePath: string; message: string }>(`/api/datasets/${datasetId}/repair`, { actions })
}

export const activateDataset = async (datasetId: string, datasetType: 'training' | 'prediction'): Promise<DatasetInfo> => {
  return http.post<any, DatasetInfo>(`/api/datasets/${datasetId}/activate`, { datasetType })
}

export interface PrepareDatasetResponse {
  success: boolean
  datasetId: string
  preparedFilePath?: string
  repairedFilePath?: string
  rowCount?: number
  columns?: string[]
  qualityStatus?: 'unchecked' | 'passed' | 'warning' | 'failed'
  message: string
}

export const prepareDataset = async (
  datasetId: string,
  payload: { autoRepair?: boolean; activate?: boolean } = { autoRepair: true, activate: true }
): Promise<PrepareDatasetResponse> => {
  return http.post<any, PrepareDatasetResponse>(`/api/datasets/${datasetId}/prepare`, payload)
}
