import React, { useState, useEffect } from 'react'
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Modal,
  Descriptions, Popconfirm, message, Typography, Badge, Alert, Empty
} from 'antd'
import { getModelList, promoteModel, rollbackModel } from '@/api/modelApi'
import {
  EyeOutlined, RocketOutlined, RollbackOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  CloseCircleOutlined, InboxOutlined
} from '@ant-design/icons'
import type { TableProps } from 'antd'

const { Title, Text } = Typography

// 模型版本类型定义
interface ModelVersion {
  id: string
  version: string
  modelName: string
  algorithm: 'random_forest' | 'xgboost' | 'lightgbm'
  status: 'candidate' | 'staging' | 'production' | 'archived' | 'rejected'
  dataRange: string
  mae: number
  mape: number
  rmse: number
  r2: number
  createdAt: string
  publishedAt?: string
  createdBy: string
  // 详情字段
  features: string[]
  params: Record<string, any>
  remark?: string
  datasetId?: string
  datasetFilePath?: string
  rowCount?: number
  featureDatasetPath?: string
  trainDatasetPath?: string
  testDatasetPath?: string
  trainSampleCount?: number
  testSampleCount?: number
  trainDataStart?: string
  trainDataEnd?: string
}

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<ModelVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentModel, setCurrentModel] = useState<ModelVersion | null>(null)

  // 获取当前production模型
  const productionModel = models.find(m => m.status === 'production')

  // 加载模型列表
  const loadModels = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getModelList()
      // 转换字段适配前端类型
      const formattedModels: ModelVersion[] = data.map((model: any) => ({
        id: model.id || model.version,
        version: model.version,
        modelName: model.modelName || '外购电预测模型',
        algorithm: model.algorithm,
        status: model.status,
        dataRange: `${model.trainDataStart || '-'} ~ ${model.trainDataEnd || '-'}`,
        mae: model.mae || 0,
        mape: model.mape || 0,
        rmse: model.rmse || 0,
        r2: model.r2 || 0,
        createdAt: model.createdAt,
        publishedAt: model.publishedAt,
        createdBy: 'admin',
        features: model.features || [],
        params: model.params || {},
        remark: model.remark,
        datasetId: model.datasetId,
        datasetFilePath: model.datasetFilePath,
        rowCount: model.rowCount,
        featureDatasetPath: model.featureDatasetPath,
        trainDatasetPath: model.trainDatasetPath,
        testDatasetPath: model.testDatasetPath,
        trainSampleCount: model.trainSampleCount,
        testSampleCount: model.testSampleCount,
        trainDataStart: model.trainDataStart,
        trainDataEnd: model.trainDataEnd
      }))
      setModels(formattedModels)
    } catch (error) {
      setLoadError(true)
      setModels([])
      message.error('模型列表加载失败，请检查后端服务')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  // 状态配置
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    production: { color: 'success', icon: <CheckCircleOutlined />, text: '生产环境' },
    staging: { color: 'orange', icon: <WarningOutlined />, text: '预发布' },
    candidate: { color: 'blue', icon: <ClockCircleOutlined />, text: '待上线' },
    archived: { color: 'default', icon: <InboxOutlined />, text: '已归档' },
    rejected: { color: 'error', icon: <CloseCircleOutlined />, text: '已拒绝' }
  }

  // 发布为生产模型
  const handlePublish = async (model: ModelVersion) => {
    try {
      await promoteModel(model.version)
      message.success(`模型 ${model.version} 已成功发布为生产版本`)
      // 刷新列表
      await loadModels()
    } catch (error: any) {
      message.error(`发布失败：${error?.response?.data?.detail || error.message}`)
      console.error(error)
    }
  }

  // 回滚到该版本
  const handleRollback = async (model: ModelVersion) => {
    try {
      await rollbackModel(model.version)
      message.success(`已成功回滚到版本 ${model.version}`)
      // 刷新列表
      await loadModels()
    } catch (error: any) {
      message.error(`回滚失败：${error?.response?.data?.detail || error.message}`)
      console.error(error)
    }
  }

  // 查看详情
  const handleViewDetail = (model: ModelVersion) => {
    setCurrentModel(model)
    setDetailVisible(true)
  }

  // 表格列配置
  const columns: TableProps<ModelVersion>['columns'] = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (version, record) => (
        <Space>
          {record.status === 'production' && <Badge status="success" />}
          <Text strong={record.status === 'production'}>{version}</Text>
        </Space>
      )
    },
    {
      title: '模型名称',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 160
    },
    {
      title: '算法',
      dataIndex: 'algorithm',
      key: 'algorithm',
      width: 120,
      render: (alg: string) => {
        const displayName = alg === 'random_forest' ? 'RandomForest' : alg === 'xgboost' ? 'XGBoost' : 'LightGBM'
        let color = 'blue'
        if (alg === 'lightgbm') color = 'purple'
        if (alg === 'xgboost') color = 'orange'
        return <Tag color={color}>{displayName}</Tag>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const config = statusConfig[status] || statusConfig.candidate
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '训练数据范围',
      dataIndex: 'dataRange',
      key: 'dataRange',
      width: 240
    },
    {
      title: 'MAE',
      dataIndex: 'mae',
      key: 'mae',
      width: 90,
      align: 'right',
      render: (val) => val.toFixed(2)
    },
    {
      title: 'MAPE',
      dataIndex: 'mape',
      key: 'mape',
      width: 90,
      align: 'right',
      render: (val) => <span style={{ color: val < 5 ? '#52c41a' : val < 8 ? '#faad14' : '#ff4d4f', fontWeight: 500 }}>{val.toFixed(2)}%</span>,
      sorter: (a, b) => a.mape - b.mape
    },
    {
      title: 'RMSE',
      dataIndex: 'rmse',
      key: 'rmse',
      width: 90,
      align: 'right',
      render: (val) => val.toFixed(2)
    },
    {
      title: 'R2',
      dataIndex: 'r2',
      key: 'r2',
      width: 90,
      align: 'right',
      render: (val) => val.toFixed(3)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 160,
      render: (time) => time || '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            查看详情
          </Button>
          {record.status !== 'production' && record.status !== 'rejected' && (
            <Popconfirm
              title={`确定要将版本 ${record.version} 发布为生产模型吗？`}
              description="发布后当前生产模型将自动归档，系统预测将使用新版本。"
              onConfirm={() => handlePublish(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<RocketOutlined />}>
                发布
              </Button>
            </Popconfirm>
          )}
          {record.status !== 'production' && (record.status === 'archived' || record.status === 'candidate' || record.status === 'staging') && (
            <Popconfirm
              title={`确定要回滚到版本 ${record.version} 吗？`}
              description="回滚后当前生产模型将自动归档，系统预测将使用该版本。"
              onConfirm={() => handleRollback(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<RollbackOutlined />}>
                回滚
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>模型版本管理</Title>

      {loadError && (
        <Alert
          message="模型列表加载失败，请检查后端服务"
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 当前生产模型信息 */}
      {productionModel ? (
        <Card bordered={false} style={{ marginBottom: 24, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)' }}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={6}>
              <Statistic
                title="当前生产模型版本"
                value={productionModel.version}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="算法"
                value={productionModel.algorithm === 'random_forest' ? 'RandomForest' : productionModel.algorithm === 'xgboost' ? 'XGBoost' : 'LightGBM'}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="上线时间"
                value={productionModel.publishedAt}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="当前MAPE"
                value={productionModel.mape}
                suffix="%"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
          <div style={{ marginTop: 16, color: '#666' }}>
            <Text type="secondary">提示：系统同一时间仅允许一个生产模型，发布新版本后旧版本将自动归档。</Text>
          </div>
        </Card>
      ) : (
        <Alert
          message="暂无生产模型，请发布一个 candidate 模型。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 模型版本列表 */}
      <Card
        bordered={false}
        title="模型版本列表"
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={loadModels}
            loading={loading}
          >
            刷新模型列表
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={models}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无模型版本，请先在训练任务页面创建训练任务。" /> }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
        />
      </Card>

      {/* 模型详情弹窗 */}
      <Modal
        title="模型详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentModel && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="版本号" span={1}>
                {currentModel.version}
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={1}>
                <Tag
                  icon={statusConfig[currentModel.status].icon}
                  color={statusConfig[currentModel.status].color}
                >
                  {statusConfig[currentModel.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="模型名称" span={2}>
                {currentModel.modelName}
              </Descriptions.Item>
              <Descriptions.Item label="算法" span={1}>
                <Tag
                  color={
                    currentModel.algorithm === 'random_forest'
                      ? 'blue'
                      : currentModel.algorithm === 'lightgbm'
                      ? 'purple'
                      : 'orange'
                  }
                >
                  {currentModel.algorithm === 'random_forest' ? 'RandomForest' : currentModel.algorithm === 'xgboost' ? 'XGBoost' : 'LightGBM'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人" span={1}>
                {currentModel.createdBy}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={1}>
                {currentModel.createdAt}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间" span={1}>
                {currentModel.publishedAt || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="训练数据范围" span={2}>
                {currentModel.dataRange}
              </Descriptions.Item>
              <Descriptions.Item label="数据集ID" span={1}>
                {currentModel.datasetId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="数据行数" span={1}>
                {currentModel.rowCount || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="数据集路径" span={2}>
                {currentModel.datasetFilePath || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="训练样本数" span={1}>
                {currentModel.trainSampleCount ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="测试样本数" span={1}>
                {currentModel.testSampleCount ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="特征数据路径" span={2}>
                {currentModel.featureDatasetPath || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="训练集路径" span={2}>
                {currentModel.trainDatasetPath || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="测试集路径" span={2}>
                {currentModel.testDatasetPath || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="MAE" span={1}>
                {currentModel.mae.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="MAPE" span={1}>
                <span style={{ color: currentModel.mape < 5 ? '#52c41a' : currentModel.mape < 8 ? '#faad14' : '#ff4d4f', fontWeight: 500 }}>
                  {currentModel.mape.toFixed(2)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="RMSE" span={1}>
                {currentModel.rmse.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="R2" span={1}>
                {currentModel.r2.toFixed(3)}
              </Descriptions.Item>
              <Descriptions.Item label="特征列表" span={2}>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {currentModel.features.map((feat, idx) => (
                    <Tag key={idx} style={{ marginBottom: 4 }}>{feat}</Tag>
                  ))}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="超参数" span={2}>
                <pre style={{ margin: 0, maxHeight: 150, overflowY: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(currentModel.params, null, 2)}
                </pre>
              </Descriptions.Item>
              {currentModel.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {currentModel.remark}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ModelManagement
