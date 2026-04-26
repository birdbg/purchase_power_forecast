import React, { useState } from 'react'
import {
  Card, Row, Col, DatePicker, Select, Table, Button, Statistic,
  Typography, Space, Tag, message
} from 'antd'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts'
import type { TableProps } from 'antd'
import { DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

// 定义类型
interface PredictionRecord {
  id: string
  date: string
  time: string
  predict: number
  actual: number
  error: number
  errorRate: number
  modelVersion: string
  status: 'normal' | 'warning' | 'error'
}

interface ModelVersionError {
  version: string
  avgErrorRate: number
}

// 状态配置
const statusConfig = {
  normal: { color: '#52c41a', icon: <CheckCircleOutlined />, text: '正常' },
  warning: { color: '#faad14', icon: <WarningOutlined />, text: '预警' },
  error: { color: '#ff4d4f', icon: <CloseCircleOutlined />, text: '异常' }
}

// 模拟最近30天预测实际数据
const generatePredictionTrendData = () => {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('MM-DD')
    const base = 1200 + Math.random() * 300
    const predict = base
    const actual = base + (Math.random() - 0.5) * 150
    data.push({
      date,
      predict,
      actual
    })
  }
  return data
}

// 模拟每日误差率数据
const generateErrorTrendData = () => {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('MM-DD')
    const errorRate = 2 + Math.random() * 11
    data.push({
      date,
      errorRate
    })
  }
  return data
}

// 模型版本误差对比数据
const modelVersionErrorData: ModelVersionError[] = [
  { version: 'v1.2.0', avgErrorRate: 4.2 },
  { version: 'v1.1.1', avgErrorRate: 4.8 },
  { version: 'v1.1.0', avgErrorRate: 5.6 },
  { version: 'v1.0.0', avgErrorRate: 7.3 }
]

// 生成明细表格数据
const generateTableData = (): PredictionRecord[] => {
  const data: PredictionRecord[] = []
  const versions = ['v1.2.0', 'v1.1.1', 'v1.1.0', 'v1.0.0']
  
  for (let i = 29; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
    // 每天生成3条记录，分别是0点，12点，18点
    for (const time of ['00:00', '12:00', '18:00']) {
      const base = 1200 + Math.random() * 300
      const predict = base
      const actual = base + (Math.random() - 0.5) * 150
      const error = predict - actual
      const errorRate = Math.abs(error / actual * 100)
      
      let status: 'normal' | 'warning' | 'error' = 'normal'
      if (errorRate >= 5 && errorRate < 10) status = 'warning'
      if (errorRate >= 10) status = 'error'
      
      data.push({
        id: `${date}-${time}`,
        date,
        time,
        predict: Math.round(predict * 10) / 10,
        actual: Math.round(actual * 10) / 10,
        error: Math.round(error * 10) / 10,
        errorRate: Math.round(errorRate * 100) / 100,
        modelVersion: versions[Math.floor(Math.random() * versions.length)],
        status
      })
    }
  }
  return data
}

// 模拟数据
const predictionTrendData = generatePredictionTrendData()
const errorTrendData = generateErrorTrendData()
const tableData = generateTableData()

const PredictionMonitor: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [modelVersion, setModelVersion] = useState<string>('all')
  const [errorStatus, setErrorStatus] = useState<string>('all')

  // 表格列配置
  const columns: TableProps<PredictionRecord>['columns'] = [
    {
      title: '预测日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    },
    {
      title: '预测时间',
      dataIndex: 'time',
      key: 'time',
      width: 100
    },
    {
      title: '预测外购电量',
      dataIndex: 'predict',
      key: 'predict',
      width: 140,
      align: 'right',
      render: (val) => `${val} MWh`
    },
    {
      title: '实际外购电量',
      dataIndex: 'actual',
      key: 'actual',
      width: 140,
      align: 'right',
      render: (val) => `${val} MWh`
    },
    {
      title: '误差值',
      dataIndex: 'error',
      key: 'error',
      width: 120,
      align: 'right',
      render: (val) => <span style={{ color: val > 0 ? '#ff4d4f' : '#52c41a' }}>{val} MWh</span>
    },
    {
      title: '误差率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 120,
      align: 'right',
      render: (val) => (
        <span style={{ color: val < 5 ? '#52c41a' : val < 10 ? '#faad14' : '#ff4d4f', fontWeight: 500 }}>
          {val}%
        </span>
      ),
      sorter: (a, b) => a.errorRate - b.errorRate
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 120,
      render: (version) => <Tag color="blue">{version}</Tag>,
      filters: [
        { text: 'v1.2.0', value: 'v1.2.0' },
        { text: 'v1.1.1', value: 'v1.1.1' },
        { text: 'v1.1.0', value: 'v1.1.0' },
        { text: 'v1.0.0', value: 'v1.0.0' }
      ],
      onFilter: (value, record) => record.modelVersion === value
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusConfig[status]
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
      },
      filters: [
        { text: '正常', value: 'normal' },
        { text: '预警', value: 'warning' },
        { text: '异常', value: 'error' }
      ],
      onFilter: (value, record) => record.status === value
    }
  ]

  // 导出CSV（mock实现）
  const handleExport = () => {
    message.success('CSV导出成功，文件已下载')
  }

  // 计算指标
  const last7DaysAvgError = 3.8
  const last30DaysAvgError = 4.2
  const maxDayError = 12.3
  const errorCount = 3

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>外购电预测监控</Title>
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
          导出CSV
        </Button>
      </div>

      {/* 筛选区域 */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>日期范围：</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              style={{ width: 'calc(100% - 80px)' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>模型版本：</Text>
            <Select
              value={modelVersion}
              onChange={setModelVersion}
              style={{ width: 'calc(100% - 80px)' }}
              placeholder="请选择模型版本"
            >
              <Option value="all">全部版本</Option>
              <Option value="v1.2.0">v1.2.0</Option>
              <Option value="v1.1.1">v1.1.1</Option>
              <Option value="v1.1.0">v1.1.0</Option>
              <Option value="v1.0.0">v1.0.0</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>误差状态：</Text>
            <Select
              value={errorStatus}
              onChange={setErrorStatus}
              style={{ width: 'calc(100% - 80px)' }}
              placeholder="请选择误差状态"
            >
              <Option value="all">全部</Option>
              <Option value="normal">正常</Option>
              <Option value="warning">预警</Option>
              <Option value="error">异常</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 指标卡片区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="最近7天平均误差率"
              value={last7DaysAvgError}
              precision={2}
              suffix="%"
              valueStyle={{ color: last7DaysAvgError < 5 ? '#52c41a' : last7DaysAvgError < 10 ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="最近30天平均误差率"
              value={last30DaysAvgError}
              precision={2}
              suffix="%"
              valueStyle={{ color: last30DaysAvgError < 5 ? '#52c41a' : last30DaysAvgError < 10 ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="最大单日误差"
              value={maxDayError}
              precision={1}
              suffix="%"
              valueStyle={{ color: maxDayError < 5 ? '#52c41a' : maxDayError < 10 ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="异常预测次数"
              value={errorCount}
              valueStyle={{ color: errorCount === 0 ? '#52c41a' : errorCount < 5 ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主图表：预测vs实际 */}
      <Card title="预测外购电 vs 实际外购电" bordered={false} style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={predictionTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(val) => [`${Number(val).toFixed(1)} MWh`, '']} />
            <Legend />
            <Line type="monotone" dataKey="actual" stroke="#1890ff" name="实际外购电" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="predict" stroke="#52c41a" name="预测外购电" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 辅助图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="每日误差率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={errorTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(val) => [`${Number(val).toFixed(2)}%`, '误差率']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="errorRate" 
                  name="误差率" 
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: (data: any) => {
                      const val = data.errorRate
                      return val < 5 ? '#52c41a' : val < 10 ? '#faad14' : '#ff4d4f'
                    }
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="模型版本误差对比" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelVersionErrorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" />
                <YAxis />
                <Tooltip formatter={(val) => [`${Number(val).toFixed(2)}%`, '平均误差率']} />
                <Bar dataKey="avgErrorRate" name="平均误差率">
                  {modelVersionErrorData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.avgErrorRate < 5 ? '#52c41a' : entry.avgErrorRate < 10 ? '#faad14' : '#ff4d4f'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 明细表格 */}
      <Card title="预测结果明细" bordered={false}>
        <Table
          columns={columns}
          dataSource={tableData}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  )
}

export default PredictionMonitor
