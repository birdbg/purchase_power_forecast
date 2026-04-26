import React from 'react'
import { Card } from 'antd'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export interface PredictionActualDataPoint {
  /** 时间戳/日期 */
  datetime: string
  /** 预测值 */
  predictValue: number
  /** 实际值 */
  actualValue: number
}

export interface PredictionActualChartProps {
  /** 图表数据 */
  data: PredictionActualDataPoint[]
  /** 图表高度，默认300px */
  height?: number
  /** 图表标题 */
  title?: string
  /** 预测值线条颜色，默认#1890ff */
  predictColor?: string
  /** 实际值线条颜色，默认#52c41a */
  actualColor?: string
  /** 是否显示网格，默认true */
  showGrid?: boolean
  /** 是否显示图例，默认true */
  showLegend?: boolean
  /** 是否显示Tooltip，默认true */
  showTooltip?: boolean
  /** X轴数据字段，默认datetime */
  xAxisKey?: string
  /** 自定义X轴格式化函数 */
  xAxisFormatter?: (value: string) => string
  /** 自定义Y轴格式化函数 */
  yAxisFormatter?: (value: number) => string
  /** 自定义Tooltip格式化函数 */
  tooltipFormatter?: (value: number, name: string) => [string, string]
  /** 加载状态 */
  loading?: boolean
}

const PredictionActualChart: React.FC<PredictionActualChartProps> = ({
  data,
  height = 300,
  title,
  predictColor = '#1890ff',
  actualColor = '#52c41a',
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisKey = 'datetime',
  xAxisFormatter,
  yAxisFormatter,
  tooltipFormatter,
  loading = false
}) => {
  if (loading) {
    return (
      <Card bordered={false} loading style={{ height }}>
        <div />
      </Card>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      {title && (
        <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 500 }}>
          {title}
        </h4>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 12 }}
            tickFormatter={xAxisFormatter}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={yAxisFormatter}
          />
          {showTooltip && <Tooltip formatter={tooltipFormatter} />}
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey="predictValue"
            stroke={predictColor}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="预测值"
          />
          <Line
            type="monotone"
            dataKey="actualValue"
            stroke={actualColor}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="实际值"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PredictionActualChart
