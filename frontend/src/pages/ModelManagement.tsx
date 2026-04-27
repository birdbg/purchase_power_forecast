import React, { useState, useEffect } from 'react'
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Modal,
  Descriptions, Popconfirm, message, Typography, Badge
} from 'antd'
import { getModelList, promoteModel, rollbackModel } from '@/api/modelApi'
import {
  EyeOutlined, RocketOutlined, RollbackOutlined, InboxOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  CloseCircleOutlined, FileTextOutlined
} from '@ant-design/icons'
import type { TableProps } from 'antd'

const { Title, Text } = Typography

// 模型版本类型定义
interface ModelVersion {
  id: string
  version: string
  modelName: string
  algorithm: 'XGBoost' | 'LightGBM' | 'RandomForest'
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
}

// 模拟模型版本数据
const mockModels: ModelVersion[] = [
  {
    id: 'MOD20260426001',
    version: 'v1.2.0',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'production',
    dataRange: '2025-01-01 ~ 2026-03-31',
    mae: 56.8,
    mape: 4.2,
    rmse: 72.5,
    r2: 0.927,
    createdAt: '2026-04-26 10:35:00',
    publishedAt: '2026-04-26 11:00:00',
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 400, max_depth: 10, min_samples_leaf: 2, random_state: 42 },
    remark: '当前生产环境模型，效果最优'
  },
  {
    id: 'MOD20260426002',
    version: 'v1.1.1',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    status: 'staging',
    dataRange: '2025-01-01 ~ 2026-03-31',
    mae: 62.3,
    mape: 4.8,
    rmse: 78.1,
    r2: 0.918,
    createdAt: '2026-04-26 11:20:00',
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 500, max_depth: 6, learning_rate: 0.05, subsample: 0.9 }
  },
  {
    id: 'MOD20260425001',
    version: 'v1.1.0',
    modelName: '外购电预测模型',
    algorithm: 'LightGBM',
    status: 'candidate',
    dataRange: '2025-01-01 ~ 2026-02-28',
    mae: 68.5,
    mape: 5.6,
    rmse: 85.3,
    r2: 0.905,
    createdAt: '2026-04-25 16:10:00',
    createdBy: 'operator',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance', 'purchase_lag_1', 'purchase_lag_7', 'purchase_rolling_7'],
    params: { n_estimators: 500, learning_rate: 0.05, num_leaves: 31, subsample: 0.9 }
  },
  {
    id: 'MOD20260420001',
    version: 'v1.0.0',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    status: 'archived',
    dataRange: '2024-01-01 ~ 2025-12-31',
    mae: 78.2,
    mape: 7.3,
    rmse: 98.6,
    r2: 0.876,
    createdAt: '2026-04-20 09:30:00',
    publishedAt: '2026-04-20 10:00:00',
    createdBy: 'admin',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output', 'rolling_output', 'temperature', 'is_holiday', 'is_maintenance'],
    params: { n_estimators: 300, max_depth: 8, min_samples_leaf: 3 },
    remark: '旧版本已归档'
  },
  {
    id: 'MOD20260418001',
    version: 'v0.9.0',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    status: 'rejected',
    dataRange: '2024-06-01 ~ 2025-12-31',
    mae: 95.6,
    mape: 11.2,
    rmse: 120.5,
    r2: 0.812,
    createdAt: '2026-04-18 14:20:00',
    createdBy: 'operator',
    features: ['weekday', 'month', 'is_weekend', 'total_power', 'self_power', 'steel_output'],
    params: { n_estimators: 400, max_depth: 5 },
    remark: '误差过大，拒绝上线'
  }
]

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<ModelVersion[]>(mockModels)
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentModel, setCurrentModel] = useState<ModelVersion | null>(null)

  // 获取当前production模型
  const productionModel = models.find(m => m.status === 'production')

  // 加载模型列表
  const loadModels = async () => {
    setLoading(true)
    try {
      const data = await getModelList()
      // 转换字段适配前端类型
      const formattedModels = data.map((model: any) => ({
        id: model.id,
        version: model.version,
        modelName: '外购电预测模型',
        algorithm: model.algorithm === 'random_forest' ? 'RandomForest' :
                   model.algorithm === 'xgboost' ? 'XGBoost' : 'LightGBM',
        status: model.status,
        dataRange: `${model.trainDataStart} ~ ${model.trainDataEnd}`,
        mae: model.mae,
        mape: model.mape,
        rmse: model.rmse,
        r2: model.r2,
        createdAt: model.createdAt,
        publishedAt: model.publishedAt,
        createdBy: 'admin',
        features: model.features,
        params: model.params,
        remark: model.remark
      }))
      setModels(formattedModels)
    } catch (error) {
      message.error('加载模型列表失败')
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

  // 归档模型
  const handleArchive = (model: ModelVersion) => {
    const updated = models.map(m =>
      m.id === model.id ? { ...m, status: 'archived' as const } : m
    )
    setModels(updated)
    message.success(`模型 ${model.version} 已归档`)
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
        let color = 'blue'
        if (alg === 'LightGBM') color = 'purple'
        if (alg === 'XGBoost') color = 'orange'
        return <Tag color={color}>{alg}</Tag>
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
          {record.status !== 'production' && record.status !== 'archived' && (
            <Popconfirm
              title={`确定要归档版本 ${record.version} 吗？`}
              description="归档后模型将不再出现在可发布列表中，但可以随时回滚。"
              onConfirm={() => handleArchive(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<InboxOutlined />}>
                归档
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

      {/* 当前生产模型信息 */}
      {productionModel && (
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
                value={productionModel.algorithm}
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
      )}

      {/* 模型版本列表 */}
      <Card bordered={false} title="模型版本列表">
        <Table
          columns={columns}
          dataSource={models}
          rowKey="id"
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
                    currentModel.algorithm === 'RandomForest'
                      ? 'blue'
                      : currentModel.algorithm === 'LightGBM'
                      ? 'purple'
                      : 'orange'
                  }
                >
                  {currentModel.algorithm}
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
