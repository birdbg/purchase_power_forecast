import React from 'react'
import { Tag } from 'antd'

// 模型状态类型
export type ModelStatus = 'candidate' | 'staging' | 'production' | 'archived' | 'rejected'

// 训练任务状态类型
export type TrainingStatus = 'running' | 'success' | 'failed' | 'canceled'

// 预测结果状态类型
export type PredictionStatus = 'normal' | 'warning' | 'abnormal'

export type StatusTagType = ModelStatus | TrainingStatus | PredictionStatus

export interface StatusTagProps {
  /** 状态值 */
  status: StatusTagType
  /** 自定义显示文本，不传则用默认文本 */
  text?: string
  /** 是否显示边框 */
  bordered?: boolean
  /** 自定义样式 */
  style?: React.CSSProperties
}

// 状态类名映射
const statusClassMap: Record<StatusTagType, string> = {
  // 模型状态
  candidate: 'status-tag-running',
  staging: 'status-tag-warning',
  production: 'status-tag-success',
  archived: '',
  rejected: 'status-tag-abnormal',

  // 训练状态
  running: 'status-tag-running',
  success: 'status-tag-success',
  failed: 'status-tag-abnormal',
  canceled: '',

  // 预测状态
  normal: 'status-tag-normal',
  warning: 'status-tag-warning',
  abnormal: 'status-tag-abnormal'
}

// 状态默认文本映射
const statusTextMap: Record<StatusTagType, string> = {
  // 模型状态文本
  candidate: '候选',
  staging: '待发布',
  production: '生产',
  archived: '已归档',
  rejected: '已拒绝',

  // 训练状态文本
  running: '运行中',
  success: '成功',
  failed: '失败',
  canceled: '已取消',

  // 预测状态文本
  normal: '正常',
  warning: '警告',
  abnormal: '异常'
}

const StatusTag: React.FC<StatusTagProps> = ({
  status,
  text,
  bordered = true,
  style
}) => {
  const className = statusClassMap[status]
  const displayText = text || statusTextMap[status] || status

  return (
    <Tag
      className={className}
      bordered={bordered}
      style={{
        borderRadius: '4px',
        ...style
      }}
    >
      {displayText}
    </Tag>
  )
}

export default StatusTag
