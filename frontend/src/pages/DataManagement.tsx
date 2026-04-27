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

const requiredFields = [
  'date',
  'purchase_power',
  'total_power',
  'self_power',
  'steel_output',
  'rolling_output',
  'temperature',
  'is_holiday',
  'is_maintenance'
]

const numericFields = [
  'purchase_power',
  'total_power',
  'self_power',
  'steel_output',
  'rolling_output',
  'temperature',
  'purchase_lag_1',
  'purchase_lag_7',
  'purchase_rolling_7'
]

const lagFields = ['purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7']

const parseCsvLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0]).map(header => header.replace(/^\uFEFF/, '').trim())
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index]?.trim() || ''
      return record
    }, {})
  })

  return { headers, rows }
}

const DataManagement: React.FC = () => {
  const [checking, setChecking] = useState(false)
  const [historyFile, setHistoryFile] = useState<File | null>(null)
  const [qualityResults, setQualityResults] = useState<QualityCheckResult[]>([])
  const [dataSummary, setDataSummary] = useState({
    rowCount: 0,
    dateRange: '-',
    missingCount: 0,
    abnormalCount: 0
  })

  // 上传历史数据配置
  const historyUploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      setHistoryFile(file)
      setQualityResults([])
      setDataSummary({
        rowCount: 0,
        dateRange: '-',
        missingCount: 0,
        abnormalCount: 0
      })
      message.success(`已选择历史数据文件：${file.name}`)
      return false // 阻止自动上传
    }
  }

  // 上传预测输入数据配置
  const predictUploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      message.success(`已选择预测输入数据文件：${file.name}`)
      return false // 阻止自动上传
    }
  }

  // 数据质量检查
  const handleQualityCheck = () => {
    if (!historyFile) {
      message.warning('请先上传历史数据')
      return
    }

    const fileName = historyFile.name.toLowerCase()
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      message.warning('Excel 质量检查暂未支持，请先另存为 CSV')
      return
    }

    if (!fileName.endsWith('.csv')) {
      message.warning('第一版质量检查仅支持 CSV 文件')
      return
    }

    setChecking(true)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const { headers, rows } = parseCsv(text)
        const headerSet = new Set(headers)
        const missingRequiredFields = requiredFields.filter(field => !headerSet.has(field))

        const dateMissingCount = headerSet.has('date')
          ? rows.filter(row => !row.date).length
          : rows.length
        const purchaseMissingCount = headerSet.has('purchase_power')
          ? rows.filter(row => !row.purchase_power).length
          : rows.length

        let negativeValueCount = 0
        numericFields.forEach(field => {
          if (!headerSet.has(field)) return
          rows.forEach(row => {
            const value = row[field]
            if (value !== '' && Number(value) < 0) {
              negativeValueCount += 1
            }
          })
        })

        const dateCounts = new Map<string, number>()
        if (headerSet.has('date')) {
          rows.forEach(row => {
            if (!row.date) return
            dateCounts.set(row.date, (dateCounts.get(row.date) || 0) + 1)
          })
        }
        const duplicateDateCount = Array.from(dateCounts.values()).reduce(
          (sum, count) => sum + Math.max(0, count - 1),
          0
        )

        let lagMissingCount = 0
        lagFields.forEach(field => {
          if (!headerSet.has(field)) {
            lagMissingCount += rows.length
            return
          }
          lagMissingCount += rows.filter(row => !row[field]).length
        })

        const rowCountWarning = rows.length < 30 ? 1 : 0
        const dates = rows
          .map(row => row.date)
          .filter(Boolean)
          .sort()
        const dateRange = dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '-'

        const results: QualityCheckResult[] = [
          {
            key: 'required-fields',
            checkItem: '必填字段存在检查',
            result: missingRequiredFields.length > 0 ? 'fail' : 'pass',
            problemCount: missingRequiredFields.length,
            suggestion: missingRequiredFields.length > 0
              ? `缺少字段：${missingRequiredFields.join(', ')}`
              : '无需处理'
          },
          {
            key: 'date-missing',
            checkItem: 'date 缺失检查',
            result: dateMissingCount > 0 ? 'fail' : 'pass',
            problemCount: dateMissingCount,
            suggestion: dateMissingCount > 0 ? '补充 date 或删除对应记录' : '无需处理'
          },
          {
            key: 'purchase-power-missing',
            checkItem: 'purchase_power 缺失检查',
            result: purchaseMissingCount > 0 ? 'fail' : 'pass',
            problemCount: purchaseMissingCount,
            suggestion: purchaseMissingCount > 0 ? '补充外购电量或删除对应记录' : '无需处理'
          },
          {
            key: 'negative-values',
            checkItem: '数值字段负数检查',
            result: negativeValueCount > 0 ? 'fail' : 'pass',
            problemCount: negativeValueCount,
            suggestion: negativeValueCount > 0 ? '检查并修正负数异常值' : '无需处理'
          },
          {
            key: 'duplicate-date',
            checkItem: '日期重复检查',
            result: duplicateDateCount > 0 ? 'warning' : 'pass',
            problemCount: duplicateDateCount,
            suggestion: duplicateDateCount > 0 ? '删除或合并重复日期记录' : '无需处理'
          },
          {
            key: 'lag-missing',
            checkItem: 'lag 字段缺失检查',
            result: lagMissingCount > 0 ? 'warning' : 'pass',
            problemCount: lagMissingCount,
            suggestion: lagMissingCount > 0 ? '重新生成 purchase_lag_1、purchase_lag_7、purchase_rolling_7' : '无需处理'
          },
          {
            key: 'row-count',
            checkItem: '数据行数检查',
            result: rowCountWarning > 0 ? 'warning' : 'pass',
            problemCount: rowCountWarning,
            suggestion: rowCountWarning > 0 ? '训练数据少于 30 行，建议补充更多历史数据' : '无需处理'
          }
        ]

        const totalProblems = results.reduce((sum, item) => sum + item.problemCount, 0)
        setQualityResults(results)
        setDataSummary({
          rowCount: rows.length,
          dateRange,
          missingCount: dateMissingCount + purchaseMissingCount + lagMissingCount,
          abnormalCount: negativeValueCount + duplicateDateCount
        })

        if (totalProblems === 0) {
          message.success('数据质量检查通过，未发现问题')
        } else {
          message.success(`数据质量检查完成，共发现 ${totalProblems} 个问题`)
        }
      } catch (error) {
        message.error('CSV 解析失败，请检查文件格式')
        console.error(error)
      } finally {
        setChecking(false)
      }
    }
    reader.onerror = () => {
      setChecking(false)
      message.error('文件读取失败，请重新选择 CSV 文件')
    }
    reader.readAsText(historyFile, 'utf-8')
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
            <Button icon={<UploadOutlined />}>
              上传历史数据
            </Button>
          </Upload>
          <Upload {...predictUploadProps}>
            <Button icon={<UploadOutlined />}>
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
              value={dataSummary.rowCount}
              suffix="行"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="日期范围"
              value={dataSummary.dateRange}
              valueStyle={{ color: '#722ed1', fontSize: '16px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="缺失值数量"
              value={dataSummary.missingCount}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="异常值数量"
              value={dataSummary.abnormalCount}
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
          dataSource={qualityResults}
          rowKey="key"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default DataManagement
