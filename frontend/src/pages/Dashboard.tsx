import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Spin, Typography } from 'antd'
import type { TableProps } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ArrowDownOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'

const { Title } = Typography

// 模拟指标数据
const stats = {
  modelVersion: 'v1.2.0',
  latestMape: 4.2,
  todayPrediction: 1256.8,
  todayErrorRate: 3.8
}

// 模拟最近30天预测vs实际数据
const trendData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const actual = Math.random() * 500 + 800
  const predict = actual + (Math.random() - 0.5) * 100
  return {
    date: date.toLocaleDateString('zh-CN').slice(5),
    actual,
    predict
  }
})

// 模拟最近30天误差率数据
const errorData = trendData.map(item => ({
  date: item.date,
  errorRate: Math.abs((item.predict - item.actual) / item.actual * 100)
}))

// 模拟最近10条预测记录
const recentRecords = Array.from({ length: 10 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - i)
  const actual = Math.random() * 500 + 800
  const predict = actual + (Math.random() - 0.5) * 100
  const errorRate = Math.abs((predict - actual) / actual * 100)
  
  let status: '优秀' | '正常' | '异常'
  if (errorRate < 5) status = '优秀'
  else if (errorRate < 10) status = '正常'
  else status = '异常'

  return {
    id: i + 1,
    date: date.toLocaleDateString('zh-CN'),
    predict: predict.toFixed(2),
    actual: actual.toFixed(2),
    errorRate: errorRate.toFixed(2),
    modelVersion: ['v1.2.0', 'v1.1.0'][Math.floor(Math.random() * 2)],
    status
  }
})

type RecentRecord = typeof recentRecords[number]

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setLoading(false)
    }, 1000)
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

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>系统总览</Title>

      {/* 指标卡片区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="当前生产模型版本"
              value={stats.modelVersion}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="最新预测MAPE"
              value={stats.latestMape}
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
              value={stats.todayPrediction}
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
              value={stats.todayErrorRate}
              suffix="%"
              precision={2}
              valueStyle={{ color: stats.todayErrorRate < 5 ? '#52c41a' : stats.todayErrorRate < 10 ? '#faad14' : '#ff4d4f', fontSize: 28 }}
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
        <Table
          columns={columns}
          dataSource={recentRecords}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  )
}

export default Dashboard
