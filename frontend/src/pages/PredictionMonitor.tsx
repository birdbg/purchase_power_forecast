import React, { useState, useEffect } from 'react'
import {
  Card, Row, Col, DatePicker, Select, Table, Button, Statistic,
  Typography, Space, Tag, message, Alert, Empty
} from 'antd'
import { DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { getPredictionResults, runPrediction, exportPredictionResults } from '@/api/predictApi'
import { getActiveDatasets, type DatasetInfo } from '@/api/datasetApi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import type { PredictionRecord } from '@/types/predict'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

interface ModelVersionError {
  version: string
  avgErrorRate: number
}

// 状态配置
const statusConfig = {
  normal: { color: '#52c41a', icon: <CheckCircleOutlined />, text: '正常' },
  warning: { color: '#faad14', icon: <WarningOutlined />, text: '预警' },
  error: { color: '#ff4d4f', icon: <CloseCircleOutlined />, text: '异常' },
  abnormal: { color: '#ff4d4f', icon: <CloseCircleOutlined />, text: '异常' }
}

const PredictionMonitor: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [modelVersion, setModelVersion] = useState<string>('all')
  const [errorStatus, setErrorStatus] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [predictionData, setPredictionData] = useState<PredictionRecord[]>([])
  const [batchPredictLoading, setBatchPredictLoading] = useState(false)
  const [activePredictionDataset, setActivePredictionDataset] = useState<DatasetInfo | null>(null)
  
  const loadActiveDataset = async () => {
    try {
      const active = await getActiveDatasets()
      setActivePredictionDataset(active.prediction)
    } catch (error) {
      console.error(error)
    }
  }
  
  const loadPredictions = async () => {
    setLoading(true)
    try {
      const result = await getPredictionResults()
      setPredictionData(Array.isArray(result) ? result : (result.records || []))
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '加载预测结果失败')
      setPredictionData([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadActiveDataset()
    loadPredictions()
  }, [])

  // 表格列配置
  const columns: TableProps<PredictionRecord>['columns'] = [
    {
      title: '预测日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a: any, b: any) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
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
        <span style={{ color: (val ?? 0) < 5 ? '#52c41a' : (val ?? 0) < 10 ? '#faad14' : '#ff4d4f', fontWeight: 500 }}>
          {val}%
        </span>
      ),
      sorter: (a: any, b: any) => (a.errorRate ?? 0) - (b.errorRate ?? 0)
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 120,
      render: (version) => <Tag color="blue">{version}</Tag>,
      filters: Array.from(new Set(predictionData.map((item: any) => item.modelVersion))).map(v => ({ text: v, value: v })),
      onFilter: (value, record: any) => record.modelVersion === value
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: keyof typeof statusConfig) => {
        const config = statusConfig[status] || statusConfig.error
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
      },
      filters: [
        { text: '正常', value: 'normal' },
        { text: '预警', value: 'warning' },
        { text: '异常', value: 'error' },
        { text: '异常', value: 'abnormal' }
      ],
      onFilter: (value, record: any) => record.status === value
    }
  ]

  const handleBatchPredict = async () => {
    if (!activePredictionDataset) {
      message.warning('请先在数据管理页面上传并激活预测输入数据集。')
      return
    }
    setBatchPredictLoading(true)
    try {
      message.loading('批量预测执行中，请稍候...', 0)
      const result = await runPrediction({ datasetId: activePredictionDataset.datasetId } as any)
      message.destroy()
      message.success('批量预测完成，预测结果已生成')
      await loadPredictions()
    } catch (error: any) {
      message.destroy()
      message.error(error?.response?.data?.detail || error.message || '批量预测失败')
    } finally {
      setBatchPredictLoading(false)
    }
  }

  // 导出CSV
  const handleExport = async () => {
    try {
      await exportPredictionResults()
      message.success('CSV导出成功，文件已下载')
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '导出失败')
    }
  }

  // 计算指标
  const last7DaysAvgError = predictionData.length > 0 
    ? predictionData.slice(-7).reduce((sum, item) => sum + (item.errorRate ?? 0), 0) / Math.min(7, predictionData.length)
    : 0
  const last30DaysAvgError = predictionData.length > 0
    ? predictionData.reduce((sum, item) => sum + (item.errorRate ?? 0), 0) / predictionData.length
    : 0
  const maxDayError = predictionData.length > 0
    ? Math.max(...predictionData.map(item => item.errorRate ?? 0))
    : 0
  const errorCount: number = predictionData.filter(item => (item.errorRate ?? 0) >= 10).length

  // 生成模型版本误差对比数据
  const modelVersionErrorData: ModelVersionError[] = Array.from(
    new Set(predictionData.map(item => item.modelVersion))
  ).map(version => {
    const versionData = predictionData.filter(item => item.modelVersion === version)
    const avgErrorRate = versionData.reduce((sum, item) => sum + (item.errorRate ?? 0), 0) / versionData.length
    return { version, avgErrorRate }
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>外购电预测监控</Title>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleBatchPredict}
            loading={batchPredictLoading}
            disabled={!activePredictionDataset}
          >
            执行批量预测
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出CSV
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadPredictions} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {!activePredictionDataset && (
        <Alert
          message="请先在数据管理页面上传并激活预测输入数据集，才能执行批量预测。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

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
        {predictionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={predictionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(val) => [`${Number(val).toFixed(1)} MWh`, '']} />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#1890ff" name="实际外购电" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="predict" stroke="#52c41a" name="预测外购电" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <Empty description="暂无预测数据" />
          </div>
        )}
      </Card>

      {/* 辅助图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="每日误差率趋势" bordered={false}>
            {predictionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={predictionData}>
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
                      fill: '#ff4d4f'
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <Empty description="暂无预测数据" />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="模型版本误差对比" bordered={false}>
            {modelVersionErrorData.length > 0 ? (
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
            ) : (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <Empty description="暂无模型版本数据" />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 预测结果表格 */}
      <Card title="预测结果明细" bordered={false}>
        <Table
          columns={columns}
          dataSource={predictionData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          bordered={false}
        />
      </Card>
    </div>
  )
}

export default PredictionMonitor
