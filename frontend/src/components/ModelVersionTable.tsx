import React from 'react'
import { Table, Button, Space, Popconfirm, TableProps } from 'antd'
import { EyeOutlined, CloudUploadOutlined, RollbackOutlined, InboxOutlined } from '@ant-design/icons'
import StatusTag, { ModelStatus } from './StatusTag'
import { ModelVersion } from '../types/model'

export interface ModelVersionTableProps {
  /** 模型版本列表数据 */
  data: ModelVersion[]
  /** 加载状态 */
  loading?: boolean
  /** 表格分页配置，默认关闭分页 */
  pagination?: TableProps<ModelVersion>['pagination']
  /** 是否显示操作列，默认true */
  showActionColumn?: boolean
  /** 查看详情回调 */
  onViewDetail?: (model: ModelVersion) => void
  /** 发布模型回调 */
  onPublish?: (model: ModelVersion) => void
  /** 回滚模型回调 */
  onRollback?: (model: ModelVersion) => void
  /** 归档模型回调 */
  onArchive?: (model: ModelVersion) => void
  /** 自定义表格列 */
  columns?: TableProps<ModelVersion>['columns']
  /** 表格行Key，默认version */
  rowKey?: string
}

const ModelVersionTable: React.FC<ModelVersionTableProps> = ({
  data,
  loading = false,
  pagination = false,
  showActionColumn = true,
  onViewDetail,
  onPublish,
  onRollback,
  onArchive,
  columns,
  rowKey = 'version'
}) => {
  const defaultColumns: TableProps<ModelVersion>['columns'] = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      ellipsis: true
    },
    {
      title: '模型名称',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 150,
      ellipsis: true
    },
    {
      title: '算法',
      dataIndex: 'algorithm',
      key: 'algorithm',
      width: 120,
      render: (algorithm) => <StatusTag status={algorithm as any} text={algorithm} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ModelStatus) => <StatusTag status={status} />
    },
    {
      title: '训练时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      ellipsis: true
    },
    {
      title: 'MAPE',
      dataIndex: 'mape',
      key: 'mape',
      width: 100,
      align: 'right',
      render: (mape: number) => (
        <span style={{ color: mape > 10 ? '#ff4d4f' : mape > 5 ? '#faad14' : '#52c41a' }}>
          {mape.toFixed(2)}%
        </span>
      )
    },
    {
      title: 'MAE',
      dataIndex: 'mae',
      key: 'mae',
      width: 100,
      align: 'right',
      render: (mae: number) => mae.toFixed(2)
    }
  ]

  // 操作列
  if (showActionColumn) {
    defaultColumns.push({
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {onViewDetail && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => onViewDetail(record)}
            >
              详情
            </Button>
          )}

          {/* 发布按钮：只有候选和待发布状态可以发布 */}
          {onPublish && ['candidate', 'staging'].includes(record.status) && (
            <Popconfirm
              title="确定要发布该模型到生产环境吗？"
              onConfirm={() => onPublish(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                size="small"
              >
                发布
              </Button>
            </Popconfirm>
          )}

          {/* 回滚按钮：只有生产状态可以回滚 */}
          {onRollback && record.status === 'production' && (
            <Popconfirm
              title="确定要回滚该生产模型吗？"
              onConfirm={() => onRollback(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="default"
                icon={<RollbackOutlined />}
                size="small"
              >
                回滚
              </Button>
            </Popconfirm>
          )}

          {/* 归档按钮：生产和已拒绝状态不能归档 */}
          {onArchive && !['production', 'rejected'].includes(record.status) && (
            <Popconfirm
              title="确定要归档该模型吗？归档后将无法使用。"
              onConfirm={() => onArchive(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="default"
                danger
                icon={<InboxOutlined />}
                size="small"
              >
                归档
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    })
  }

  return (
    <Table
      rowKey={rowKey}
      dataSource={data}
      columns={columns || defaultColumns}
      loading={loading}
      pagination={pagination}
      bordered={false}
      scroll={{ x: 'max-content' }}
    />
  )
}

export default ModelVersionTable
