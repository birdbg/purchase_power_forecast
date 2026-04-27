import React, { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Card, Modal, Drawer, Form, Select, DatePicker,
  Input, Switch, message, Typography, Row, Col, Alert
} from 'antd'
import { getTrainingJobs, createTrainingJob, getTrainingLog } from '@/api/trainApi'
import {
  PlusOutlined, ReloadOutlined, FileTextOutlined, BarChartOutlined,
  DeploymentUnitOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PauseCircleOutlined
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// 训练任务类型定义
interface TrainingJob {
  id: string
  modelName: string
  algorithm: 'XGBoost' | 'LightGBM' | 'RandomForest'
  dataRange: string
  startTime: string
  endTime?: string
  status: 'running' | 'success' | 'failed' | 'canceled'
  mape?: number
  mae?: number
  rmse?: number
  createdBy: string
  remark?: string
}

// 模拟训练任务数据
const mockJobs: TrainingJob[] = [
  {
    id: 'JOB20260426001',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    dataRange: '2025-01-01 ~ 2026-03-31',
    startTime: '2026-04-26 10:30:00',
    endTime: '2026-04-26 10:32:15',
    status: 'success',
    mape: 4.2,
    mae: 56.8,
    rmse: 72.5,
    createdBy: 'admin',
    remark: '季度重训任务'
  },
  {
    id: 'JOB20260426002',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    dataRange: '2025-01-01 ~ 2026-03-31',
    startTime: '2026-04-26 11:15:00',
    endTime: '2026-04-26 11:17:42',
    status: 'success',
    mape: 4.8,
    mae: 62.3,
    rmse: 78.1,
    createdBy: 'admin',
    remark: '新特征测试训练'
  },
  {
    id: 'JOB20260426003',
    modelName: '外购电预测模型',
    algorithm: 'LightGBM',
    dataRange: '2025-01-01 ~ 2026-03-31',
    startTime: '2026-04-26 14:20:00',
    status: 'running',
    createdBy: 'operator',
    remark: '自动调参训练'
  },
  {
    id: 'JOB20260425001',
    modelName: '外购电预测模型',
    algorithm: 'XGBoost',
    dataRange: '2024-01-01 ~ 2025-12-31',
    startTime: '2026-04-25 09:10:00',
    endTime: '2026-04-25 09:12:33',
    status: 'failed',
    createdBy: 'admin',
    remark: '数据缺失训练失败'
  },
  {
    id: 'JOB20260424001',
    modelName: '外购电预测模型',
    algorithm: 'RandomForest',
    dataRange: '2025-06-01 ~ 2026-03-31',
    startTime: '2026-04-24 16:40:00',
    endTime: '2026-04-24 16:41:15',
    status: 'canceled',
    createdBy: 'operator',
    remark: '手动取消训练'
  }
]

// 模拟训练日志
const mockLogs = `[2026-04-26 10:30:00] 开始加载训练数据...
[2026-04-26 10:30:05] 数据加载完成，共153条记录
[2026-04-26 10:30:06] 开始数据清洗与预处理...
[2026-04-26 10:30:10] 数据清洗完成，缺失值填充完成
[2026-04-26 10:30:11] 开始特征工程...
[2026-04-26 10:30:20] 特征工程完成，共生成13个特征
[2026-04-26 10:30:21] 开始训练模型，算法：RandomForest
[2026-04-26 10:31:35] 模型训练完成
[2026-04-26 10:31:36] 开始评估模型...
[2026-04-26 10:32:10] 模型评估完成：MAPE=4.2%, MAE=56.8, RMSE=72.5, R²=0.927
[2026-04-26 10:32:15] 训练任务结束，状态：成功`

const TrainingJobs: React.FC = () => {
  const [jobs, setJobs] = useState<TrainingJob[]>(mockJobs)
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [algorithmFilter, setAlgorithmFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentJob, setCurrentJob] = useState<TrainingJob | null>(null)
  const [form] = Form.useForm()

  // 加载任务列表
  const loadJobs = async () => {
    setLoading(true)
    try {
      const data = await getTrainingJobs()
      // 转换字段适配前端类型
      const formattedJobs = data.map((job: any) => ({
        id: job.jobId,
        modelName: job.modelName,
        algorithm: job.algorithm === 'random_forest' ? 'RandomForest' :
                   job.algorithm === 'xgboost' ? 'XGBoost' : 'LightGBM',
        dataRange: job.trainDataRange ? `${job.trainDataRange[0]} ~ ${job.trainDataRange[1]}` : '-',
        startTime: job.startTime,
        endTime: job.endTime,
        status: job.status,
        mape: job.metrics?.mape,
        mae: job.metrics?.mae,
        rmse: job.metrics?.rmse,
        createdBy: 'admin',
        remark: job.remark,
        modelVersion: job.modelVersion
      }))
      
      // 应用过滤
      let filtered = [...formattedJobs]
      if (algorithmFilter) {
        filtered = filtered.filter(job => job.algorithm === algorithmFilter)
      }
      if (statusFilter) {
        filtered = filtered.filter(job => job.status === statusFilter)
      }
      setJobs(filtered)
      message.success('列表已刷新')
    } catch (error) {
      message.error('加载训练任务列表失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [algorithmFilter, statusFilter])

  // 新建训练任务
  const handleCreateJob = async (values: any) => {
    setSubmitLoading(true)
    try {
      // 转换算法名到后端格式
      const algorithmMap: Record<string, string> = {
        'RandomForest': 'random_forest',
        'XGBoost': 'xgboost',
        'LightGBM': 'lightgbm'
      }
      
      const params = {
        modelName: 'purchase_power',
        algorithm: algorithmMap[values.algorithm],
        trainDataStart: values.dataRange[0].format('YYYY-MM-DD'),
        trainDataEnd: values.dataRange[1].format('YYYY-MM-DD'),
        remark: values.remark
      }
      
      const result = await createTrainingJob(params)
      
      if (result.success) {
        message.success(`训练任务提交成功，模型版本：${result.modelVersion}\nMAPE: ${result.metrics.mape.toFixed(2)}%`)
        setModalVisible(false)
        form.resetFields()
        // 刷新列表
        await loadJobs()
        
        // 提示用户去模型管理页面发布
        Modal.success({
          title: '训练完成',
          content: (
            <div>
              <p>模型版本：{result.modelVersion}</p>
              <p>MAPE：{result.metrics.mape.toFixed(2)}%</p>
              <p>MAE：{result.metrics.mae.toFixed(2)}</p>
              <p>RMSE：{result.metrics.rmse.toFixed(2)}</p>
              <p>R²：{result.metrics.r2.toFixed(4)}</p>
              <hr />
              <p>请前往模型管理页面发布该模型为生产版本</p>
            </div>
          )
        })
      }
    } catch (error: any) {
      message.error(`训练失败：${error?.response?.data?.detail || error.message}`)
      console.error(error)
    } finally {
      setSubmitLoading(false)
    }
  }

  // 查看日志
  const handleViewLog = async (job: TrainingJob) => {
    setCurrentJob(job)
    try {
      const logsData = await getTrainingLog(job.id)
      // 格式化日志
      const formattedLogs = logsData.map((log: any) =>
        `[${log.timestamp}] [${log.level}] ${log.content}`
      ).join('\n')
      setLogs(formattedLogs || '暂无日志')
    } catch (error) {
      message.error('加载日志失败')
      setLogs('加载日志失败')
      console.error(error)
    }
    setDrawerVisible(true)
  }

  // 查看评估
  const handleViewEvaluation = (job: TrainingJob) => {
    message.info(`查看任务 ${job.id} 评估结果功能开发中`)
  }

  // 注册模型
  const handleRegisterModel = (job: TrainingJob) => {
    message.info(`注册任务 ${job.id} 模型功能开发中`)
  }

  // 表格列配置
  const columns: TableProps<TrainingJob>['columns'] = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 160,
      ellipsis: true
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
      title: '训练数据范围',
      dataIndex: 'dataRange',
      key: 'dataRange',
      width: 240
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      render: (time) => time || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
          running: { color: 'processing', icon: <SyncOutlined spin />, text: '训练中' },
          success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          canceled: { color: 'default', icon: <PauseCircleOutlined />, text: '已取消' }
        }
        const config = statusMap[status] || statusMap.running
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: 'MAPE',
      dataIndex: 'mape',
      key: 'mape',
      width: 90,
      align: 'right',
      render: (val: number) => val ? `${val.toFixed(2)}%` : '-'
    },
    {
      title: 'MAE',
      dataIndex: 'mae',
      key: 'mae',
      width: 90,
      align: 'right',
      render: (val: number) => val ? val.toFixed(2) : '-'
    },
    {
      title: 'RMSE',
      dataIndex: 'rmse',
      key: 'rmse',
      width: 90,
      align: 'right',
      render: (val: number) => val ? val.toFixed(2) : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewLog(record)}>
            查看日志
          </Button>
          {record.status === 'success' && (
            <>
              <Button type="link" size="small" icon={<BarChartOutlined />} onClick={() => handleViewEvaluation(record)}>
                查看评估
              </Button>
              <Button type="link" size="small" icon={<DeploymentUnitOutlined />} onClick={() => handleRegisterModel(record)}>
                注册模型
              </Button>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Title level={4} style={{ margin: 0 }}>训练任务管理</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新建训练任务
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>
            刷新
          </Button>
          <Select
            placeholder="算法筛选"
            style={{ width: 140 }}
            allowClear
            value={algorithmFilter}
            onChange={setAlgorithmFilter}
          >
            <Option value="XGBoost">XGBoost</Option>
            <Option value="LightGBM">LightGBM</Option>
            <Option value="RandomForest">RandomForest</Option>
          </Select>
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="running">训练中</Option>
            <Option value="success">成功</Option>
            <Option value="failed">失败</Option>
            <Option value="canceled">已取消</Option>
          </Select>
        </Space>
      </div>

      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 新建训练任务弹窗 */}
      <Modal
        title="新建训练任务"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateJob}
          initialValues={{
            autoTune: false
          }}
        >
          <Form.Item
            name="modelName"
            label="选择模型类型"
            rules={[{ required: true, message: '请选择模型类型' }]}
            initialValue="purchase_power"
          >
            <Select placeholder="请选择模型类型">
              <Option value="purchase_power">外购电预测</Option>
              <Option value="cold_rolling">冷轧用电量预测</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="algorithm"
            label="选择算法"
            rules={[{ required: true, message: '请选择训练算法' }]}
          >
            <Select placeholder="请选择算法">
              <Option value="xgboost">XGBoost</Option>
              <Option value="lightgbm">LightGBM</Option>
              <Option value="random_forest">RandomForest</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dataRange"
            label="训练数据范围"
            rules={[{ required: true, message: '请选择训练数据范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="autoTune"
            label="启用自动调参"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交任务</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 训练日志抽屉 */}
      <Drawer
        title={`训练日志 - ${currentJob?.id}`}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={800}
      >
        <Card
          bordered={false}
          style={{ background: '#f6f8fa', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{logs}</pre>
        </Card>
      </Drawer>
    </div>
  )
}

export default TrainingJobs
