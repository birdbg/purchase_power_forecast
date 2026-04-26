import React from 'react'
import { Card, Statistic, Space, Tag } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons'

export interface MetricCardProps {
  /** 指标名称 */
  title: string
  /** 指标数值 */
  value: number | string
  /** 数值单位 */
  unit?: string
  /** 变化趋势 */
  trend?: 'up' | 'down' | 'neutral'
  /** 变化数值/百分比 */
  trendValue?: string | number
  /** 趋势描述 */
  trendDesc?: string
  /** 卡片状态颜色 */
  statusColor?: 'success' | 'warning' | 'error' | 'default'
  /** 卡片前缀图标 */
  prefixIcon?: React.ReactNode
  /** 后缀内容 */
  suffix?: React.ReactNode
  /** 是否加载中 */
  loading?: boolean
  /** 点击事件 */
  onClick?: () => void
}

const statusColorMap = {
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  default: '#1890ff'
}

const trendIconMap = {
  up: <ArrowUpOutlined style={{ color: '#ff4d4f' }} />,
  down: <ArrowDownOutlined style={{ color: '#52c41a' }} />,
  neutral: <MinusOutlined style={{ color: '#8c8c8c' }} />
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  trendDesc,
  statusColor = 'default',
  prefixIcon,
  suffix,
  loading = false,
  onClick
}) => {
  return (
    <Card
      bordered={false}
      hoverable={!!onClick}
      onClick={onClick}
      loading={loading}
      style={{
        height: '100%',
        borderLeft: `4px solid ${statusColorMap[statusColor]}`,
        borderRadius: '4px'
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>{title}</span>
          {prefixIcon && <span>{prefixIcon}</span>}
        </Space>
        
        <Statistic
          value={value}
          suffix={unit}
          valueStyle={{
            color: statusColorMap[statusColor],
            fontSize: '28px',
            fontWeight: 600
          }}
        />
        
        {(trend || trendDesc || suffix) && (
          <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="small">
              {trend && trendIconMap[trend]}
              {trendValue && <span style={{ fontSize: '12px' }}>{trendValue}</span>}
              {trendDesc && <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{trendDesc}</span>}
            </Space>
            {suffix}
          </Space>
        )}
      </Space>
    </Card>
  )
}

export default MetricCard
