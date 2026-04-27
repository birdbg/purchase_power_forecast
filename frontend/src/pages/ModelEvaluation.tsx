import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, Row, Select, Space, Spin, Statistic,
  Table, Tag, Typography, message
} from 'antd'
import {
  BarChart, Bar, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import type { TableProps } from 'antd'
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { getModelList } from '@/api/modelApi'
import { getModelEvaluation, runModelEvaluation, type EvaluationOutput, type EvaluationSample } from '@/api/evaluationApi'
import type { ModelVersion } from '@/types/model'

const { Option } = Select
const { Title, Text } = Typography

const algorithmDisplay = (algorithm: string) => {
  if (algorithm === 'random_forest') return 'RandomForest'
  if (algorithm === 'xgboost') return 'XGBoost'
  if (algorithm === 'lightgbm') return 'LightGBM'
  return algorithm || '-'
}

const statusConfig: Record<string, { color: string; text: string }> = {
  normal: { color: 'success', text: '正常' },
  warning: { color: 'warning', text: '预警' },
  abnormal: { color: 'error', text: '异常' }
}

const ModelEvaluation: React.FC = () => {
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>()
  const [evaluation, setEvaluation] = useState<EvaluationOutput | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingEvaluation, setLoadingEvaluation] = useState(false)
  const [runningEvaluation, setRunningEvaluation] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  const loadModels = async () => {
    setLoadingModels(true)
    setLoadError(undefined)
    try {
      const data = await getModelList()
      setModels(data)
      if (data.length > 0) {
        const production = data.find(model => model.status === 'production')
        const defaultVersion = production?.version || data[0].version
        setSelectedVersion(prev => prev || defaultVersion)
      } else {
        setSelectedVersion(undefined)
        setEvaluation(null)
      }
    } catch (error: any) {
      setModels([])
      setSelectedVersion(undefined)
      setEvaluation(null)
      setLoadError(error?.response?.data?.detail || error.message || '模型列表加载失败，请检查后端服务')
    } finally {
      setLoadingModels(false)
    }
  }

  const loadEvaluation = async (version: string) => {
    setLoadingEvaluation(true)
    try {
      const data = await getModelEvaluation(version)
      setEvaluation(data)
    } catch (error: any) {
      setEvaluation(null)
      message.error(error?.response?.data?.detail || error.message || '模型评估加载失败')
    } finally {
      setLoadingEvaluation(false)
    }
  }

  const handleRunEvaluation = async () => {
    if (!selectedVersion) {
      message.warning('请先选择模型版本')
      return
    }
    setRunningEvaluation(true)
    try {
      const data = await runModelEvaluation(selectedVersion)
      setEvaluation(data)
      message.success('模型评估完成')
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '模型评估失败')
    } finally {
      setRunningEvaluation(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    if (selectedVersion) {
      loadEvaluation(selectedVersion)
    }
  }, [selectedVersion])

  const samples = evaluation?.samples || []
  const predictionActualData = useMemo(() => samples.slice(0, 50).map(sample => ({
    date: sample.datetime.slice(0, 10),
    actual: sample.actualValue,
    predict: sample.predictValue
  })), [samples])

  const errorTrendData = useMemo(() => samples.slice(0, 50).map(sample => ({
    date: sample.datetime.slice(0, 10),
    errorRate: sample.errorRate
  })), [samples])

  const errorDistributionData = useMemo(() => {
    const ranges = [
      { errorRange: '< 2%', count: 0 },
      { errorRange: '2% ~ 4%', count: 0 },
      { errorRange: '4% ~ 6%', count: 0 },
      { errorRange: '6% ~ 8%', count: 0 },
      { errorRange: '8% ~ 10%', count: 0 },
      { errorRange: '> 10%', count: 0 }
    ]
    samples.forEach(sample => {
      const rate = Math.abs(sample.errorRate)
      if (rate < 2) ranges[0].count += 1
      else if (rate < 4) ranges[1].count += 1
      else if (rate < 6) ranges[2].count += 1
      else if (rate < 8) ranges[3].count += 1
      else if (rate < 10) ranges[4].count += 1
      else ranges[5].count += 1
    })
    return ranges
  }, [samples])

  const topErrorSamples = useMemo(() => [...samples]
    .sort((a, b) => Math.abs(b.errorRate) - Math.abs(a.errorRate))
    .slice(0, 10), [samples])

  const columns: TableProps<EvaluationSample>['columns'] = [
    { title: '日期', dataIndex: 'datetime', key: 'datetime', width: 160, render: value => value.slice(0, 10) },
    { title: '预测值', dataIndex: 'predictValue', key: 'predictValue', width: 120, align: 'right', render: value => value.toFixed(2) },
    { title: '实际值', dataIndex: 'actualValue', key: 'actualValue', width: 120, align: 'right', render: value => value.toFixed(2) },
    { title: '误差值', dataIndex: 'error', key: 'error', width: 120, align: 'right', render: value => value.toFixed(2) },
    { title: '误差率', dataIndex: 'errorRate', key: 'errorRate', width: 120, align: 'right', render: value => `${value.toFixed(2)}%` },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const config = statusConfig[status] || statusConfig.normal
        return <Tag color={config.color}>{config.text}</Tag>
      }
    }
  ]

  const metrics = evaluation?.metrics || {}
  const hasMetrics = evaluation && Object.keys(metrics).length > 0

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>模型效果评估</Title>

      {loadError && <Alert message={loadError} type="error" showIcon style={{ marginBottom: 24 }} />}

      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space wrap>
          <Text strong>模型版本：</Text>
          <Select
            value={selectedVersion}
            onChange={setSelectedVersion}
            style={{ width: 320 }}
            placeholder="请选择模型版本"
            loading={loadingModels}
            allowClear
          >
            {models.map(model => (
              <Option key={model.version} value={model.version}>
                {model.version} - {algorithmDisplay(model.algorithm)} - {model.status}
              </Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadModels} loading={loadingModels}>刷新模型版本</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunEvaluation}
            loading={runningEvaluation}
            disabled={!selectedVersion}
          >
            执行真实评估
          </Button>
        </Space>
      </Card>

      {loadingModels || loadingEvaluation ? (
        <Card bordered={false}><Spin tip="加载真实模型评估数据中..." /></Card>
      ) : models.length === 0 ? (
        <Card bordered={false}><Empty description="暂无模型版本，请先在训练任务页面创建训练任务。" /></Card>
      ) : !evaluation ? (
        <Card bordered={false}><Empty description="暂无该模型评估结果，请点击执行真实评估。" /></Card>
      ) : (
        <>
          <Alert
            message={`当前评估模型：${evaluation.modelVersion} / ${algorithmDisplay(evaluation.algorithm)}`}
            description={`训练数据范围：${evaluation.trainDataRange?.[0] || '-'} ~ ${evaluation.trainDataRange?.[1] || '-'}；样本数：${evaluation.totalSamples || samples.length}`}
            type={hasMetrics ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}><Card><Statistic title="MAE" value={metrics.mae || 0} precision={2} /></Card></Col>
            <Col xs={24} sm={12} md={6}><Card><Statistic title="MAPE" value={metrics.mape || 0} precision={2} suffix="%" /></Card></Col>
            <Col xs={24} sm={12} md={6}><Card><Statistic title="RMSE" value={metrics.rmse || 0} precision={2} /></Card></Col>
            <Col xs={24} sm={12} md={6}><Card><Statistic title="R2" value={metrics.r2 || 0} precision={4} /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="预测值 vs 实际值" bordered={false}>
                {predictionActualData.length > 0 ? (
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
                ) : <Empty description="暂无评估样本明细，模型指标来自训练/评估报告。" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="误差率趋势" bordered={false}>
                {errorTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={errorTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={value => [`${Number(value).toFixed(2)}%`, '误差率']} />
                      <Legend />
                      <Line type="monotone" dataKey="errorRate" stroke="#ff4d4f" name="误差率" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无误差率趋势数据" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="误差分布" bordered={false}>
                {samples.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={errorDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="errorRange" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="样本数">
                        {errorDistributionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index < 3 ? '#52c41a' : index < 5 ? '#faad14' : '#ff4d4f'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="暂无误差分布数据" />}
              </Card>
            </Col>
          </Row>

          <Card title="误差最大 Top 10 样本" bordered={false}>
            <Table columns={columns} dataSource={topErrorSamples} rowKey="id" pagination={false} locale={{ emptyText: '暂无评估样本明细' }} />
          </Card>
        </>
      )}
    </div>
  )
}

export default ModelEvaluation
