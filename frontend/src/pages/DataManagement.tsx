import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Descriptions, Row, Space, Statistic, Table,
  Tag, Typography, Upload, message
} from 'antd'
import type { TableProps, UploadProps } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined,
  ReloadOutlined, ToolOutlined, UploadOutlined, WarningOutlined
} from '@ant-design/icons'
import {
  activateDataset, getActiveDatasets, getDatasets, qualityCheckDataset,
  repairDataset, uploadDataset, prepareDataset, type DatasetInfo, type QualityCheckResult
} from '@/api/datasetApi'

const { Title, Text, Paragraph } = Typography

interface DataField {
  key: string
  fieldName: string
  description: string
  type: string
  required: boolean
  example: string
}

const fieldData: DataField[] = [
  { key: 'date', fieldName: 'date', description: '日期', type: '日期', required: true, example: '2024-01-01' },
  { key: 'purchase_power', fieldName: 'purchase_power', description: '外购电量', type: '数值', required: true, example: '1250.5' },
  { key: 'total_power', fieldName: 'total_power', description: '总用电量', type: '数值', required: true, example: '2800.3' },
  { key: 'self_power', fieldName: 'self_power', description: '自发电量', type: '数值', required: true, example: '1549.8' },
  { key: 'steel_output', fieldName: 'steel_output', description: '粗钢产量', type: '数值', required: true, example: '8500' },
  { key: 'rolling_output', fieldName: 'rolling_output', description: '轧钢产量', type: '数值', required: true, example: '7200' },
  { key: 'temperature', fieldName: 'temperature', description: '当日平均气温', type: '数值', required: true, example: '23.5' },
  { key: 'is_holiday', fieldName: 'is_holiday', description: '是否节假日', type: '布尔/数值(0/1)', required: true, example: '0' },
  { key: 'is_maintenance', fieldName: 'is_maintenance', description: '是否设备检修', type: '布尔/数值(0/1)', required: true, example: '1' }
]

const fixActionLabel: Record<string, string> = {
  generate_lag: '生成 lag 特征',
  drop_duplicate_dates: '删除重复日期',
  fill_missing_maintenance: '检修空值填 0',
  fill_missing_holiday: '节假日空值填 0',
  sort_dates: '按日期排序'
}

const DataManagement: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [activeTraining, setActiveTraining] = useState<DatasetInfo | null>(null)
  const [activePrediction, setActivePrediction] = useState<DatasetInfo | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | null>(null)
  const [qualityResults, setQualityResults] = useState<QualityCheckResult[]>([])
  const [dataSummary, setDataSummary] = useState({ rowCount: 0, dateRange: '-', missingCount: 0, abnormalCount: 0 })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const loadDatasets = async () => {
    setLoading(true)
    try {
      const [list, active] = await Promise.all([getDatasets(), getActiveDatasets()])
      setDatasets(list)
      setActiveTraining(active.training)
      setActivePrediction(active.prediction)
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '加载数据集失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDatasets()
  }, [])

  const handleUpload = async (file: File, datasetType: 'training' | 'prediction') => {
    setLoading(true)
    try {
      const dataset = await uploadDataset(file, datasetType)
      setSelectedDataset(dataset)
      setQualityResults([])
      setDataSummary({ rowCount: dataset.rowCount, dateRange: '-', missingCount: 0, abnormalCount: 0 })
      message.success(`上传成功：${dataset.fileName}，datasetId=${dataset.datasetId}`)
      await loadDatasets()
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '上传失败')
    } finally {
      setLoading(false)
    }
  }

  const historyUploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      handleUpload(file, 'training')
      return false
    }
  }

  const handleQualityCheck = async (dataset = selectedDataset) => {
    if (!dataset) {
      message.warning('请先选择或上传数据集')
      return
    }
    setChecking(true)
    try {
      const result = await qualityCheckDataset(dataset.datasetId)
      setQualityResults(result.results)
      setDataSummary(result.summary)
      message.success(result.totalProblems === 0 ? '数据质量检查通过，未发现问题' : `数据质量检查完成，共发现 ${result.totalProblems} 个问题`)
      await loadDatasets()
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '质量检查失败')
    } finally {
      setChecking(false)
    }
  }

  const repairableActions = useMemo(() => Array.from(new Set(
    qualityResults.filter(item => item.fixable && item.fixAction).map(item => item.fixAction as string)
  )), [qualityResults])

  const handleRepair = async (actions = repairableActions) => {
    if (!selectedDataset) {
      message.warning('请先选择数据集')
      return
    }
    if (actions.length === 0) {
      message.warning('当前没有可修复项')
      return
    }
    setRepairing(true)
    try {
      await repairDataset(selectedDataset.datasetId, actions)
      message.success('数据修复完成')
      await loadDatasets()
      await handleQualityCheck(selectedDataset)
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '数据修复失败')
    } finally {
      setRepairing(false)
    }
  }

  const handlePrepare = async (autoRepair = true, activate = true) => {
    if (!selectedDataset) {
      message.warning('请先选择数据集')
      return
    }
    setPreparing(true)
    try {
      const result = await prepareDataset(selectedDataset.datasetId, { autoRepair, activate })
      message.success(result.message || '数据准备完成')
      await loadDatasets()
      await handleQualityCheck(selectedDataset)
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '数据准备失败')
    } finally {
      setPreparing(false)
    }
  }

  const handleActivate = async (dataset: DatasetInfo, datasetType: 'training' | 'prediction') => {
    try {
      await activateDataset(dataset.datasetId, datasetType)
      message.success(datasetType === 'training' ? '已设为当前训练数据' : '已设为当前预测输入')
      await loadDatasets()
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error.message || '激活数据集失败')
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ['date', 'purchase_power', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7']
    const rows = [['2026-01-01', '850.5', '1200.0', '350.0', '800.0', '720.0', '20.0', '0', '0', '840.2', '830.1', '835.6']]
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

  const fieldColumns: TableProps<DataField>['columns'] = [
    { title: '字段名', dataIndex: 'fieldName', key: 'fieldName', width: 150, render: name => <Text code>{name}</Text> },
    { title: '描述', dataIndex: 'description', key: 'description', width: 150 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
    { title: '是否必填', dataIndex: 'required', key: 'required', width: 100, render: required => required ? <Tag color="red">是</Tag> : <Tag color="default">否</Tag> },
    { title: '示例', dataIndex: 'example', key: 'example', width: 150 }
  ]

  const datasetColumns: TableProps<DatasetInfo>['columns'] = [
    { title: 'datasetId', dataIndex: 'datasetId', key: 'datasetId', width: 150, ellipsis: true },
    { title: '类型', dataIndex: 'datasetType', key: 'datasetType', width: 100, render: type => <Tag color={type === 'training' ? 'blue' : 'purple'}>{type}</Tag> },
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', width: 180, ellipsis: true },
    { title: '行数', dataIndex: 'rowCount', key: 'rowCount', width: 90 },
    { title: '质量状态', dataIndex: 'qualityStatus', key: 'qualityStatus', width: 110 },
    { title: 'Active', dataIndex: 'isActive', key: 'isActive', width: 90, render: active => active ? <Tag color="success">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', key: 'actions', width: 310, render: (_, record) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => { setSelectedDataset(record); handleQualityCheck(record) }}>质检</Button>
          {record.datasetType === 'training' && <Button size="small" type="link" onClick={() => handleActivate(record, 'training')}>设为训练数据</Button>}
          {record.datasetType === 'prediction' && <Button size="small" type="link" onClick={() => handleActivate(record, 'prediction')}>设为预测输入</Button>}
        </Space>
      )
    }
  ]

  const qualityColumns: TableProps<QualityCheckResult>['columns'] = [
    { title: '检查项', dataIndex: 'checkItem', key: 'checkItem', width: 200 },
    {
      title: '检查结果', dataIndex: 'result', key: 'result', width: 120, render: result => {
        const config = result === 'pass'
          ? { icon: <CheckCircleOutlined />, color: '#52c41a', text: '通过' }
          : result === 'warning'
            ? { icon: <WarningOutlined />, color: '#faad14', text: '警告' }
            : { icon: <CloseCircleOutlined />, color: '#ff4d4f', text: '不通过' }
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
      }
    },
    { title: '问题数量', dataIndex: 'problemCount', key: 'problemCount', width: 120, align: 'center', render: count => count > 0 ? <Text strong type="danger">{count}</Text> : count },
    { title: '建议处理方式', dataIndex: 'suggestion', key: 'suggestion' },
    {
      title: '处理', key: 'fix', width: 150, render: (_, record) => record.fixable && record.fixAction ? (
        <Button size="small" icon={<ToolOutlined />} onClick={() => handleRepair([record.fixAction!])}>{fixActionLabel[record.fixAction]}</Button>
      ) : '-'
    }
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>数据管理</Title>

      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space wrap>
          <Upload {...historyUploadProps}><Button icon={<UploadOutlined />} loading={loading}>上传历史数据 CSV</Button></Upload>
          <Button onClick={() => handleQualityCheck()} loading={checking}>数据质量检查</Button>
          <Button icon={<ToolOutlined />} onClick={() => handleRepair()} loading={repairing}>修复数据</Button>
          <Button type="primary" onClick={() => handlePrepare()} loading={preparing}>一键检查并准备数据</Button>
          <Button icon={<ReloadOutlined />} onClick={loadDatasets} loading={loading}>刷新数据集</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载数据模板</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Alert
            message="当前训练数据集"
            description={activeTraining ? `${activeTraining.datasetId} / ${activeTraining.fileName} / ${activeTraining.rowCount} 行` : '暂无，请上传训练 CSV 并设为训练数据'}
            type={activeTraining ? 'success' : 'warning'}
            showIcon
          />
        </Col>
        <Col xs={24} lg={12}>
          <Alert
            message="当前预测输入数据集"
            description={activePrediction ? `${activePrediction.datasetId} / ${activePrediction.fileName} / ${activePrediction.rowCount} 行` : '暂无，请上传预测输入 CSV 并设为预测输入'}
            type={activePrediction ? 'success' : 'warning'}
            showIcon
          />
        </Col>
      </Row>

      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Alert
          message="MVP 阶段使用说明"
          description="实验阶段可只上传一份历史数据。系统会使用该数据训练模型，并支持使用最后7天作为预测验证数据。预测输入CSV仅用于正式生产预测场景。"
          type="info"
          showIcon
        />
      </Card>

      {selectedDataset && (
        <Card title="当前选中数据集" bordered={false} style={{ marginBottom: 24 }}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="datasetId">{selectedDataset.datasetId}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedDataset.datasetType}</Descriptions.Item>
            <Descriptions.Item label="文件名">{selectedDataset.fileName}</Descriptions.Item>
            <Descriptions.Item label="行数">{selectedDataset.rowCount}</Descriptions.Item>
            <Descriptions.Item label="文件路径" span={2}>{selectedDataset.filePath}</Descriptions.Item>
            {selectedDataset.repairedFilePath && (
              <Descriptions.Item label="修复后文件路径" span={2}>{selectedDataset.repairedFilePath}</Descriptions.Item>
            )}
            {selectedDataset.preparedFilePath && (
              <Descriptions.Item label="特征工程后文件路径" span={2}>{selectedDataset.preparedFilePath}</Descriptions.Item>
            )}
            <Descriptions.Item label="日期范围">{selectedDataset.dateStart && selectedDataset.dateEnd ? `${selectedDataset.dateStart} 至 ${selectedDataset.dateEnd}` : '未检测到'}</Descriptions.Item>
            {selectedDataset.preparedDateStart && selectedDataset.preparedDateEnd && (
              <Descriptions.Item label="特征工程后日期范围">{`${selectedDataset.preparedDateStart} 至 ${selectedDataset.preparedDateEnd}`}</Descriptions.Item>
            )}
            <Descriptions.Item label="字段" span={2}>{selectedDataset.columns.join(', ')}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="数据总行数" value={dataSummary.rowCount} suffix="行" /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="日期范围" value={dataSummary.dateRange} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="缺失值数量" value={dataSummary.missingCount} suffix="个" /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="异常值数量" value={dataSummary.abnormalCount} suffix="个" /></Card></Col>
      </Row>

      <Alert
        message="真实数据闭环说明"
        description={<div><Paragraph style={{ margin: 0 }}>• 上传会保存到后端 data/uploads</Paragraph><Paragraph style={{ margin: '4px 0' }}>• 质量检查、修复、激活均由后端 Dataset 接口完成</Paragraph><Paragraph style={{ margin: 0 }}>• 训练任务只会使用已激活或指定的训练数据集</Paragraph></div>}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="已上传数据集" bordered={false} style={{ marginBottom: 24 }}>
        <Table columns={datasetColumns} dataSource={datasets} rowKey="datasetId" loading={loading} scroll={{ x: 1000 }} />
      </Card>

      <Card title="数据字段说明" bordered={false} style={{ marginBottom: 24 }}>
        <Table columns={fieldColumns} dataSource={fieldData} rowKey="key" pagination={false} />
      </Card>

      <Card title="数据质量检查结果" bordered={false}>
        <Table columns={qualityColumns} dataSource={qualityResults} rowKey="key" pagination={false} />
      </Card>
    </div>
  )
}

export default DataManagement
