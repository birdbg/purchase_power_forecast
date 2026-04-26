import React, { useState } from 'react'
import {
  Card, Row, Col, Select, DatePicker, Table, Alert, Statistic,
  Typography, Space, Tag
} from 'antd'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts'
import type { TableProps } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

// 定义类型
interface EvaluationMetrics {
  mae: number
  mape: number
  rmse: number
  r2: number
  maxError: number
  peakMape: number
  vsProduction: {
    mae: number
    mape: number
    rmse: number
  }
}

interface PredictionActualItem {
  date: string
  actual: number
  predict: number
}

interface ErrorTrendItem {
  date: string
  errorRate: number
}

interface ErrorDistributionItem {
  errorRange: string
  count: number
}

interface ScenarioMapeItem {
  scenario: string
  mape: number
}

interface ErrorSampleItem {
  id: string
  date: string
  predict: number
  actual: number
  error: number
  errorRate: number
  scenario: string
  reason: string
}

interface ModelVersionOption {
  id: string
  version: string
  name: string
}

// 模拟数据
const mockModelVersions: ModelVersionOption[] = [
  { id: 'MOD20260426001', version: 'v1.2.0', name: 'RandomForest 最优模型' },
  { id: 'MOD20260426002', version: 'v1.1.1', name: 'XGBoost 优化版' },
  { id: 'MOD20260425001', version: 'v1.1.0', name: 'LightGBM 基础版' },
  { id: 'MOD20260420001', version: 'v1.0.0', name: 'RandomForest 旧版' }
]

const mockMetrics: EvaluationMetrics = {
  mae: 56.8,
  mape: 4.2,
  rmse: 72.5,
  r2: 0.927,
  maxError: 189.3,
  peakMape: 5.1,
  vsProduction: {
    mae: -12.3,
    mape: -0.8,
    rmse: -9.7
  }
}

// 生成预测实际对比数据
const generatePredictionActualData = (): PredictionActualItem[] => {
  const data: PredictionActualItem[] = []
  for (let i = 0; i < 30; i++) {
    const date = dayjs().subtract(29 - i, 'day').format('MM-DD')
    const base = 1200 + Math.random() * 300
    data.push({
      date,
      actual: base,
      predict: base + (Math.random() - 0.5) * 100
    })
  }
  return data
}

// 误差趋势数据
const generateErrorTrendData = (): ErrorTrendItem[] => {
  const data: ErrorTrendItem[] = []
  for (let i = 0; i < 30; i++) {
    const date = dayjs().subtract(29 - i, 'day').format('MM-DD')
    data.push({
      date,
      errorRate: 2 + Math.random() * 6
    })
  }
  return data
}

// 误差分布数据
const errorDistributionData: ErrorDistributionItem[] = [
  { errorRange: '< 2%', count: 124 },
  { errorRange: '2% ~ 4%', count: 216 },
  { errorRange: '4% ~ 6%', count: 158 },
  { errorRange: '6% ~ 8%', count: 67 },
  { errorRange: '8% ~ 10%', count: 28 },
  { errorRange: '> 10%', count: 12 }
]

// 场景MAPE对比
const scenarioMapeData: ScenarioMapeItem[] = [
  { scenario: '全部', mape: 4.2 },
  { scenario: '正常生产', mape: 3.8 },
  { scenario: '检修', mape: 7.5 },
  { scenario: '节假日', mape: 6.2 },
  { scenario: '高负荷', mape: 5.1 }
]

// 误差最大Top10样本
const errorSampleData: ErrorSampleItem[] = [
  {
    id: '1',
    date: '2026-04-25',
    predict: 1526.8,
    actual: 1716.1,
    error: 189.3,
    errorRate: 11.03,
    scenario: '高负荷',
    reason: '临时增产计划未纳入特征'
  },
  {
    id: '2',
    date: '2026-04-20',
    predict: 982.5,
    actual: 1128.3,
    error: 145.8,
    errorRate: 12.92,
    scenario: '节假日',
    reason: '假期补班未识别'
  },
  {
    id: '3',
    date: '2026-04-18',
    predict: 1382.6,
    actual: 1253.2,
    error: -129.4,
    errorRate: -10.33,
    scenario: '检修',
    reason: '设备检修提前结束'
  },
  {
    id: '4',
    date: '2026-04-15',
    predict: 1452.1,
    actual: 1568.7,
    error: 116.6,
    errorRate: 7.43,
    scenario: '高负荷',
    reason: '订单超预期'
  },
  {
    id: '5',
    date: '2026-04-12',
    predict: 1123.5,
    actual: 1225.8,
    error: 102.3,
    errorRate: 8.35,
    scenario: '正常生产',
    reason: '气温突变'
  },
  {
    id: '6',
    date: '2026-04-10',
    predict: 1082.6,
    actual: 986.4,
    error: -96.2,
    errorRate: -9.75,
    scenario: '检修',
    reason: '临时安排检修'
  },
  {
    id: '7',
    date: '2026-04-08',
    predict: 1526.3,
    actual: 1602.5,
    error: 76.2,
    errorRate: 4.75,
    scenario: '高负荷',
    reason: '正常波动'
  },
  {
    id: '8',
    date: '2026-04-05',
    predict: 852.6,
    actual: 912.3,
    error: 59.7,
    errorRate: 6.54,
    scenario: '节假日',
    reason: '部分岗位值班'
  },
  {
    id: '9',
    date: '2026-04-03',
    predict: 1326.8,
    actual: 1278.5,
    error: -48.3,
    errorRate: -3.78,
    scenario: '正常生产',
    reason: '正常波动'
  },
  {
    id: '10',
    date: '2026-04-01',
    predict: 1426.9,
    actual: 1472.3,
    error: 45.4,
    errorRate: 3.08,
    scenario: '正常生产',
    reason: '正常波动'
  }
]

// 场景标签颜色
const scenarioColorMap: Record<string, string> = {
  '正常生产': 'green',
  '检修': 'orange',
  '节假日': 'purple',
  '高负荷': 'red',
  '全部': 'blue'
}

const ModelEvaluation: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string>('MOD20260426001')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [scenario, setScenario] = useState<string>('all')

  const predictionActualData = generatePredictionActualData()
  const errorTrendData = generateErrorTrendData()

  // 表格列配置
  const columns: TableProps<ErrorSampleItem>['columns'] = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120
    },
    {
      title: '预测值',
      dataIndex: 'predict',
      key: 'predict',
      width: 120,
      align: 'right',
      render: (val) => val.toFixed(1)
    },
    {
      title: '实际值',
      dataIndex: 'actual',
      key: 'actual',
      width: 120,
      align: 'right',
      render: (val) => val.toFixed(1)
    },
    {
      title: '误差值',
      dataIndex: 'error',
      key: 'error',
      width: 120,
      align: 'right',
      render: (val) => <span style={{ color: val > 0 ? '#ff4d4f' : '#52c41a' }}>{val.toFixed(1)}</span>
    },
    {
      title: '误差率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 120,
      align: 'right',
      render: (val) => (
        <span style={{ color: Math.abs(val) > 8 ? '#ff4d4f' : Math.abs(val) > 5 ? '#faad14' : '#52c41a', fontWeight: 500 }}>
          {val.toFixed(2)}%
        </span>
      ),
      sorter: (a, b) => Math.abs(a.errorRate) - Math.abs(b.errorRate)
    },
    {
      title: '场景',
      dataIndex: 'scenario',
      key: 'scenario',
      width: 120,
      render: (scen) => <Tag color={scenarioColorMap[scen]}>{scen}</Tag>
    },
    {
      title: '可能原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    }
  ]

  // 计算结论
  const isMeetThreshold = mockMetrics.mape < 5
  const isBetterThanProduction = mockMetrics.vsProduction.mape < 0
  let conclusionType: 'success' | 'warning' | 'error' = 'warning'
  let conclusionText = ''
  let suggestion = ''

  if (isMeetThreshold && isBetterThanProduction) {
    conclusionType = 'success'
    conclusionText = '模型达到上线门槛，且优于当前生产模型'
    suggestion = '建议：可直接上线'
  } else if (isMeetThreshold) {
    conclusionType = 'warning'
    conclusionText = '模型达到上线门槛，但效果略差于当前生产模型'
    suggestion = '建议：可上线进行AB测试'
  } else {
    conclusionType = 'error'
    conclusionText = '模型未达到上线门槛'
    suggestion = '建议：需要补充特征或调整参数优化后再评估'
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>模型效果评估</Title>

      {/* 筛选区域 */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>模型版本：</Text>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 'calc(100% - 80px)' }}
              placeholder="请选择模型版本"
            >
              {mockModelVersions.map(model => (
                <Option key={model.id} value={model.id}>
                  {model.version} - {model.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>时间范围：</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              style={{ width: 'calc(100% - 80px)' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Text strong style={{ marginRight: 8 }}>场景筛选：</Text>
            <Select
              value={scenario}
              onChange={setScenario}
              style={{ width: 'calc(100% - 80px)' }}
              placeholder="请选择场景"
            >
              <Option value="all">全部</Option>
              <Option value="normal">正常生产</Option>
              <Option value="maintenance">检修</Option>
              <Option value="holiday">节假日</Option>
              <Option value="high_load">高负荷</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 指标卡片区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="MAE"
              value={mockMetrics.mae}
              precision={1}
              valueStyle={{ color: '#1890ff' }}
              suffix={
                mockMetrics.vsProduction.mae < 0 ?
                  <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                    <ArrowDownOutlined /> {Math.abs(mockMetrics.vsProduction.mae).toFixed(1)}
                  </span> :
                  <span style={{ fontSize: 14, color: '#ff4d4f', marginLeft: 8 }}>
                    <ArrowUpOutlined /> {mockMetrics.vsProduction.mae.toFixed(1)}
                  </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="MAPE"
              value={mockMetrics.mape}
              precision={2}
              valueStyle={{ color: mockMetrics.mape < 5 ? '#52c41a' : mockMetrics.mape < 8 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}
              suffix={
                <Space>
                  <span>%</span>
                  {mockMetrics.vsProduction.mape < 0 ?
                    <span style={{ fontSize: 14, color: '#52c41a' }}>
                      <ArrowDownOutlined /> {Math.abs(mockMetrics.vsProduction.mape).toFixed(2)}%
                    </span> :
                    <span style={{ fontSize: 14, color: '#ff4d4f' }}>
                      <ArrowUpOutlined /> {mockMetrics.vsProduction.mape.toFixed(2)}%
                    </span>
                  }
                </Space>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="RMSE"
              value={mockMetrics.rmse}
              precision={1}
              valueStyle={{ color: '#722ed1' }}
              suffix={
                mockMetrics.vsProduction.rmse < 0 ?
                  <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                    <ArrowDownOutlined /> {Math.abs(mockMetrics.vsProduction.rmse).toFixed(1)}
                  </span> :
                  <span style={{ fontSize: 14, color: '#ff4d4f', marginLeft: 8 }}>
                    <ArrowUpOutlined /> {mockMetrics.vsProduction.rmse.toFixed(1)}
                  </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="R2"
              value={mockMetrics.r2}
              precision={3}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="最大误差"
              value={mockMetrics.maxError}
              precision={1}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={4}>
          <Card>
            <Statistic
              title="峰值时段MAPE"
              value={mockMetrics.peakMape}
              precision={2}
              suffix="%"
              valueStyle={{ color: mockMetrics.peakMape < 6 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="预测值 vs 实际值" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={predictionActualData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#1890ff" name="实际值" strokeWidth={2} />
                <Line type="monotone" dataKey="predict" stroke="#52c41a" name="预测值" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="误差率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={errorTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(val) => [`${Number(val).toFixed(2)}%`, '误差率']} />
                <Legend />
                <Line type="monotone" dataKey="errorRate" stroke="#ff4d4f" name="误差率" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="误差分布" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={errorDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="errorRange" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="样本数">
                  {errorDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#52c41a' : index < 5 ? '#faad14' : '#ff4d4f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="不同场景MAPE对比" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scenarioMapeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="scenario" />
                <YAxis />
                <Tooltip formatter={(val) => [`${Number(val).toFixed(2)}%`, 'MAPE']} />
                <Bar dataKey="mape" name="MAPE">
                  {scenarioMapeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.mape < 5 ? '#52c41a' : entry.mape < 8 ? '#faad14' : '#ff4d4f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 误差最大Top10样本 */}
      <Card title="误差最大Top 10样本" bordered={false} style={{ marginBottom: 24 }}>
        <Table
          columns={columns}
          dataSource={errorSampleData}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 结论区域 */}
      <Alert
        message={
          <Space>
            {conclusionType === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            <Text strong>{conclusionText}</Text>
          </Space>
        }
        description={suggestion}
        type={conclusionType}
        showIcon
      />
    </div>
  )
}

export default ModelEvaluation
