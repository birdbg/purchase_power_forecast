import http from './http'

export interface EvaluationSample {
  id: string
  datetime: string
  predictValue: number
  actualValue: number
  error: number
  errorRate: number
  modelVersion: string
  status: 'normal' | 'warning' | 'abnormal'
}

export interface EvaluationOutput {
  modelVersion: string
  algorithm: string
  trainDataRange: [string, string]
  metrics: {
    mae?: number
    mape?: number
    rmse?: number
    r2?: number
    max_error?: number
  }
  samples: EvaluationSample[]
  totalSamples: number
  abnormalSamples: number
  warningSamples: number
}

export const getModelEvaluation = async (version: string): Promise<EvaluationOutput> => {
  return http.get<any, EvaluationOutput>(`/api/evaluation/${version}`)
}

export const runModelEvaluation = async (version: string): Promise<EvaluationOutput> => {
  const result = await http.post<any, { success: boolean; result: EvaluationOutput }>(`/api/evaluation/${version}/run`)
  return result.result
}
