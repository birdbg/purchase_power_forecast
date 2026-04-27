import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Spin, Typography, Alert, Empty } from 'antd'
import type { TableProps } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ArrowDownOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { getDashboardSummary, getPredictionTrend, getErrorTrend } from '@/api/dashboardApi'
import { getPredictionResults } from '@/api/predictApi'

const { Title } = Typography

interface RecentRecord {
  id: string | number
  date: string
  predict: number | string
  actual: number | string | null
  errorRate: number | string | null
  modelVersion: string
  status: '优秀' | '正常' | '异常'
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>({})
  const [trendData, setTrendData] = useState<any[]>([])
  const [errorData, setErrorData] = useState<any[]>([])
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [hasProductionModel, setHasProductionModel] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [summaryRes, trendRes, errorRes, recordsRes] = await Promise.all([
          getDashboardSummary(),
          getPredictionTrend(30),
          getErrorTrend(30),
          getPredictionResults({ pageSize: 10 })
        ])
        setSummary(summaryRes)
        setHasProductionModel(summaryRes.hasProductionModel ?? true)
        
        // Normalize trend data field mapping
        const normalizedTrendData = Array.isArray(trendRes) ? trendRes.map((item: any) => ({
          date: item.date || item.datetime,
          actual: item.actual ?? item.actualValue,
          predict: item.predict ?? item.predictValue
        })) : []
        setTrendData(normalizedTrendData)
        
        // Normalize error trend data field mapping
        const normalizedErrorData = Array.isArray(errorRes) ? errorRes.map((item: any) => ({
          date: item.date || item.datetime,
          errorRate: item.errorRate,
          threshold: item.threshold ?? 5
        })) : []
        setErrorData(normalizedErrorData)
        
        const records = Array.isArray(recordsRes) ? recordsRes : recordsRes.records ?? []
        setRecentRecords(records.map((item: any, idx: number) => {
          const errorRate = item.errorRate ?? 0
          let status: RecentRecord['status'] = '优秀'
          if (errorRate >= 5 && errorRate < 10) status = '正常'
          else if (errorRate >= 10) status = '异常'
          return {
            id: item.id ?? idx + 1,
            date: item.datetime ?? item.date,
            predict: item.predictValue ?? item.predicted_purchase_power,
            actual: item.actualValue ?? item.purchase_power,
            errorRate: errorRate.toFixed(2),
            modelVersion: item.modelVersion ?? 'unknown',
            status
          }
        }))
      } catch (err) {
        console.error('获取Dashboard数据失败', err)
        setHasProductionModel(false)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 表格列配置
  const columns: TableProps<RecentRecord>['columns'] = [
    {
      title: '预测日期',
      dataIndex: 'date',
      key: 'date',
      width: 120
    },
    {
      title: '预测值(万kWh)',
      dataIndex: 'predict',
      key: 'predict',
      width: 150,
      align: 'right' as const
    },
    {
      title: '实际值(万kWh)',
      dataIndex: 'actual',
      key: 'actual',
      width: 150,
      align: 'right' as const
    },
    {
      title: '误差率(%)',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 120,
      align: 'right' as const,
      render: (rate: string) => {
        const num = parseFloat(rate)
        let color = '#52c41a'
        if (num >= 5 && num < 10) color = '#faad14'
        if (num >= 10) color = '#ff4d4f'
        return <span style={{ color, fontWeight: 500 }}>{rate}%</span>
      }
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        let color = 'success'
        let icon = <CheckCircleOutlined />
        if (status === '正常') {
          color = 'warning'
          icon = <WarningOutlined />
        } else if (status === '异常') {
          color = 'error'
          icon = <CloseCircleOutlined />
        }
        return <Tag icon={icon} color={color}>{status}</Tag>
      }
    }
  ]

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>
  }

  if (!hasProductionModel) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>系统总览</Title>
        <Alert
          message="暂无生产模型，请先训练并发布模型。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      </div>
    )
  }

  const todayErrorRate = summary.todayErrorRate ?? 0
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>系统总览</Title>

      {/* 指标卡片区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="当前生产模型版本"
              value={summary.currentModelVersion ?? '-'}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="最新预测MAPE"
              value={summary.latestMape ?? 0}
              suffix="%"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="今日预测外购电量"
              value={summary.todayPrediction ?? 0}
              suffix="万kWh"
              precision={1}
              valueStyle={{ color: '#722ed1', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="今日预测误差率"
              value={todayErrorRate}
              suffix="%"
              precision={2}
              valueStyle={{ color: todayErrorRate < 5 ? '#52c41a' : todayErrorRate < 10 ? '#faad14' : '#ff4d4f', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="最近30天预测值 vs 实际值" bordered={false}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#8c8c8c" />
                <YAxis stroke="#8c8c8c" />
                <Tooltip formatter={(value: number) => [`${value.toFixed(2)} 万kWh`, '']} />
                <Legend />
                <Line type="monotone" dataKey="actual" name="实际值" stroke="#52c41a" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="predict" name="预测值" stroke="#1890ff" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近30天误差率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={errorData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#8c8c8c" />
                <YAxis stroke="#8c8c8c" unit="%" />
                <Tooltip formatter={(value: number) => [`${value.toFixed(2)} %`, '误差率']} />
                <Legend />
                <Line type="monotone" dataKey="errorRate" name="误差率" stroke="#fa8c16" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 最近预测记录表格 */}
      <Card title="最近10条预测记录" bordered={false}>
        {recentRecords.length > 0 ? (
          <Table
            columns={columns}
            dataSource={recentRecords}
            rowKey="id"
            pagination={false}
            scroll={{ x: 800 }}
          />
        ) : (
          <Empty description="暂无预测记录" />
        )}
      </Card>
    </div>
  )
}

export default Dashboard
