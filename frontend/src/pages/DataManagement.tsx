import React, { useState } from 'react'
import {
  Card, Row, Col, Button, Upload, Table, Alert, Statistic,
  Typography, Space, Tag, message
} from 'antd'
import type { TableProps, UploadProps } from 'antd'
import { UploadOutlined, DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

// 定义类型
interface DataField {
  key: string
  fieldName: string
  description: string
  type: string
  required: boolean
  example: string
}

interface QualityCheckResult {
  key: string
  checkItem: string
  result: 'pass' | 'warning' | 'fail'
  problemCount: number
  suggestion: string
}

// 数据字段说明
const fieldData: DataField[] = [
  {
    key: 'date',
    fieldName: 'date',
    description: '日期',
    type: '日期',
    required: true,
    example: '2024-01-01'
  },
  {
    key: 'purchase_power',
    fieldName: 'purchase_power',
    description: '外购电量',
    type: '数值',
    required: true,
    example: '1250.5'
  },
  {
    key: 'total_power',
    fieldName: 'total_power',
    description: '总用电量',
    type: '数值',
    required: true,
    example: '2800.3'
  },
  {
    key: 'self_power',
    fieldName: 'self_power',
    description: '自发电量',
    type: '数值',
    required: true,
    example: '1549.8'
  },
  {
    key: 'steel_output',
    fieldName: 'steel_output',
    description: '粗钢产量',
    type: '数值',
    required: true,
    example: '8500'
  },
  {
    key: 'rolling_output',
    fieldName: 'rolling_output',
    description: '轧钢产量',
    type: '数值',
    required: true,
    example: '7200'
  },
  {
    key: 'temperature',
    fieldName: 'temperature',
    description: '当日平均气温',
    type: '数值',
    required: true,
    example: '23.5'
  },
  {
    key: 'is_holiday',
    fieldName: 'is_holiday',
    description: '是否节假日',
    type: '布尔/数值(0/1)',
    required: true,
    example: '0'
  },
  {
    key: 'is_maintenance',
    fieldName: 'is_maintenance',
    description: '是否设备检修',
    type: '布尔/数值(0/1)',
    required: true,
    example: '1'
  }
]

// 数据质量检查结果
const qualityCheckData: QualityCheckResult[] = [
  {
    key: '1',
    checkItem: '日期格式检查',
    result: 'pass',
    problemCount: 0,
    suggestion: '无需处理'
  },
  {
    key: '2',
    checkItem: '外购电量非空检查',
    result: 'warning',
    problemCount: 3,
    suggestion: '补充缺失值或删除对应记录'
  },
  {
    key: '3',
    checkItem: '数值范围合理性检查',
    result: 'fail',
    problemCount: 7,
    suggestion: '修正异常值或确认数据真实性'
  },
  {
    key: '4',
    checkItem: '时间连续性检查',
    result: 'pass',
    problemCount: 0,
    suggestion: '无需处理'
  },
  {
    key: '5',
    checkItem: '时间粒度一致性检查',
    result: 'pass',
    problemCount: 0,
    suggestion: '无需处理'
  },
  {
    key: '6',
    checkItem: '重复记录检查',
    result: 'warning',
    problemCount: 2,
    suggestion: '删除重复记录'
  }
]

const DataManagement: React.FC = () => {
  const [uploading, setUploading] = useState(false)
  const [checking, setChecking] = useState(false)

  // 上传历史数据配置
  const historyUploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      setUploading(true)
      // 模拟上传
      setTimeout(() => {
        setUploading(false)
        message.success(`历史数据 ${file.name} 上传成功`)
      }, 1500)
      return false // 阻止自动上传
    }
  }

  // 上传预测输入数据配置
  const predictUploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      setUploading(true)
      // 模拟上传
      setTimeout(() => {
        setUploading(false)
        message.success(`预测输入数据 ${file.name} 上传成功`)
      }, 1500)
      return false // 阻止自动上传
    }
  }

  // 数据质量检查
  const handleQualityCheck = () => {
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      message.success('数据质量检查完成，共发现 12 个问题')
    }, 2000)
  }

  // 下载数据模板
  const handleDownloadTemplate = () => {
    const headers = [
      'date',
      'purchase_power',
      'total_power',
      'self_power',
      'steel_output',
      'rolling_output',
      'temperature',
      'is_holiday',
      'is_maintenance',
      'purchase_lag_1',
      'purchase_lag_7',
      'purchase_rolling_7'
    ]

    const rows = [
      ['2026-01-01', '850.5', '1200.0', '350.0', '800.0', '720.0', '20.0', '0', '0', '840.2', '830.1', '835.6']
    ]

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '外购电预测数据模板.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    message.success('数据模板下载成功')
  }

  // 数据字段表列配置
  const fieldColumns: TableProps<DataField>['columns'] = [
    {
      title: '字段名',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 150,
      render: (name) => <Text code>{name}</Text>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 150
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120
    },
    {
      title: '是否必填',
      dataIndex: 'required',
      key: 'required',
      width: 100,
      render: (required) => required ? <Tag color="red">是</Tag> : <Tag color="default">否</Tag>
    },
    {
      title: '示例',
      dataIndex: 'example',
      key: 'example',
      width: 150
    }
  ]

  // 质量检查表列配置
  const qualityColumns: TableProps<QualityCheckResult>['columns'] = [
    {
      title: '检查项',
      dataIndex: 'checkItem',
      key: 'checkItem',
      width: 200
    },
    {
      title: '检查结果',
      dataIndex: 'result',
      key: 'result',
      width: 120,
      render: (result) => {
        let icon, color, text
        switch (result) {
          case 'pass':
            icon = <CheckCircleOutlined />
            color = '#52c41a'
            text = '通过'
            break
          case 'warning':
            icon = <WarningOutlined />
            color = '#faad14'
            text = '警告'
            break
          case 'fail':
            icon = <CloseCircleOutlined />
            color = '#ff4d4f'
            text = '不通过'
            break
        }
        return <Tag icon={icon} color={color}>{text}</Tag>
      }
    },
    {
      title: '问题数量',
      dataIndex: 'problemCount',
      key: 'problemCount',
      width: 120,
      align: 'center',
      render: (count) => count > 0 ? <Text strong type="danger">{count}</Text> : count
    },
    {
      title: '建议处理方式',
      dataIndex: 'suggestion',
      key: 'suggestion'
    }
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>数据管理</Title>

      {/* 顶部操作区 */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space wrap>
          <Upload {...historyUploadProps}>
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传历史数据
            </Button>
          </Upload>
          <Upload {...predictUploadProps}>
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传预测输入数据
            </Button>
          </Upload>
          <Button onClick={handleQualityCheck} loading={checking} type="primary">
            数据质量检查
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载数据模板
          </Button>
        </Space>
      </Card>

      {/* 数据概览卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="历史数据总行数"
              value={1095}
              suffix="行"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="日期范围"
              value="2021-01-01 ~ 2023-12-31"
              valueStyle={{ color: '#722ed1', fontSize: '16px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="缺失值数量"
              value={3}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="异常值数量"
              value={7}
              suffix="个"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 页面提示 */}
      <Alert
        message="数据上传注意事项"
        description={
          <div>
            <Paragraph style={{ margin: 0 }}>• 训练数据必须按时间排序</Paragraph>
            <Paragraph style={{ margin: '4px 0' }}>• 外购电量不能为空</Paragraph>
            <Paragraph style={{ margin: '4px 0' }}>• 所有数值字段单位必须统一</Paragraph>
            <Paragraph style={{ margin: 0 }}>• 时间粒度必须一致（按天/按小时等）</Paragraph>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 数据字段说明表 */}
      <Card title="数据字段说明" bordered={false} style={{ marginBottom: 24 }}>
        <Table
          columns={fieldColumns}
          dataSource={fieldData}
          rowKey="key"
          pagination={false}
        />
      </Card>

      {/* 数据质量检查结果 */}
      <Card title="数据质量检查结果" bordered={false}>
        <Table
          columns={qualityColumns}
          dataSource={qualityCheckData}
          rowKey="key"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default DataManagement
