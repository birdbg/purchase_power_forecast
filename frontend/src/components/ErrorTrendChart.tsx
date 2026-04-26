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
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

export interface ErrorTrendDataPoint {
  /** 时间戳/日期 */
  datetime: string
  /** 误差率（百分比） */
  errorRate: number
}

export interface ErrorTrendChartProps {
  /** 图表数据 */
  data: ErrorTrendDataPoint[]
  /** 图表高度，默认300px */
  height?: number
  /** 图表标题 */
  title?: string
  /** 误差率线条颜色，默认#fa8c16 */
  errorColor?: string
  /** 是否显示5%参考线，默认true */
  showWarningLine?: boolean
  /** 是否显示10%参考线，默认true */
  showDangerLine?: boolean
  /** 5%参考线颜色，默认#faad14 */
  warningLineColor?: string
  /** 10%参考线颜色，默认#ff4d4f */
  dangerLineColor?: string
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

const ErrorTrendChart: React.FC<ErrorTrendChartProps> = ({
  data,
  height = 300,
  title,
  errorColor = '#fa8c16',
  showWarningLine = true,
  showDangerLine = true,
  warningLineColor = '#faad14',
  dangerLineColor = '#ff4d4f',
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

  const defaultYAxisFormatter = (value: number) => `${value}%`

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
            tickFormatter={yAxisFormatter || defaultYAxisFormatter}
          />
          {showTooltip && (
            <Tooltip
              formatter={tooltipFormatter || ((value: number) => [`${value}%`, '误差率'])}
            />
          )}
          {showLegend && <Legend />}

          {/* 5% 警告参考线 */}
          {showWarningLine && (
            <ReferenceLine
              y={5}
              stroke={warningLineColor}
              strokeDasharray="3 3"
              label={{ value: '5% 阈值', position: 'right', fill: warningLineColor, fontSize: 12 }}
            />
          )}

          {/* 10% 异常参考线 */}
          {showDangerLine && (
            <ReferenceLine
              y={10}
              stroke={dangerLineColor}
              strokeDasharray="3 3"
              label={{ value: '10% 阈值', position: 'right', fill: dangerLineColor, fontSize: 12 }}
            />
          )}

          <Line
            type="monotone"
            dataKey="errorRate"
            stroke={errorColor}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="误差率"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ErrorTrendChart
