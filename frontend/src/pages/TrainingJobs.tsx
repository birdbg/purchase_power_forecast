import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import {
  Table, Button, Space, Tag, Card, Modal, Drawer, Form, Select, DatePicker,
  Input, Switch, message, Typography, Alert, Spin
} from 'antd'
import { getTrainingJobs, createTrainingJob, getTrainingLog } from '@/api/trainApi'
import {
  PlusOutlined, ReloadOutlined, FileTextOutlined, BarChartOutlined,
  DeploymentUnitOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PauseCircleOutlined
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import { getActiveDatasets, getDatasets, type DatasetInfo } from '@/api/datasetApi'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// 训练任务类型定义
interface TrainingJob {
  id: string
  modelName: string
  algorithm: 'random_forest' | 'xgboost' | 'lightgbm'
  dataRange: string
  startTime: string
  endTime?: string
  status: 'running' | 'success' | 'failed' | 'canceled'
  mape?: number
  mae?: number
  rmse?: number
  createdBy: string
  remark?: string
  modelVersion?: string
  datasetId?: string
  trainSampleCount?: number
  testSampleCount?: number
}

const TrainingJobs: React.FC = () => {
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [algorithmFilter, setAlgorithmFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentJob, setCurrentJob] = useState<TrainingJob | null>(null)
  const [trainingDatasets, setTrainingDatasets] = useState<DatasetInfo[]>([])
  const [activeTrainingDataset, setActiveTrainingDataset] = useState<DatasetInfo | null>(null)
  const [form] = Form.useForm()

  // Get dataset date range, prefer prepared date range
  const getDatasetDateRange = (dataset?: DatasetInfo | null) => {
    if (!dataset) return null
    const start = dataset.preparedDateStart || dataset.dateStart
    const end = dataset.preparedDateEnd || dataset.dateEnd
    if (!start || !end) return null
    return [dayjs(start), dayjs(end)]
  }

  // Disable dates outside dataset range
  const disabledTrainingDate = (current: dayjs.Dayjs | null) => {
    if (!current) return false
    const datasetId = form.getFieldValue("datasetId")
    const dataset = trainingDatasets.find(d => d.datasetId === datasetId) || activeTrainingDataset
    const start = dataset?.preparedDateStart || dataset?.dateStart
    const end = dataset?.preparedDateEnd || dataset?.dateEnd
    if (!start || !end) return false
    return current.isBefore(dayjs(start), 'day') || current.isAfter(dayjs(end), 'day')
  }

  const loadDatasets = async () => {
    try {
      const [datasets, active] = await Promise.all([getDatasets(), getActiveDatasets()])
      const training = datasets.filter(dataset => dataset.datasetType === 'training')
      setTrainingDatasets(training)
      setActiveTrainingDataset(active.training)
      if (active.training) {
        form.setFieldsValue({ datasetId: active.training.datasetId })
        const dateRange = getDatasetDateRange(active.training)
        if (dateRange) {
          form.setFieldsValue({ dataRange: dateRange })
        }
      }
    } catch (error) {
      console.error(error)
      message.error('加载训练数据集失败')
    }
  }

  // 加载任务列表
  const loadJobs = async () => {
    setLoading(true)
    try {
      const data = await getTrainingJobs()
      // 转换字段适配前端类型
      const formattedJobs = data.map((job: any) => ({
        id: job.jobId,
        modelName: job.modelName,
        algorithm: job.algorithm,
        dataRange: job.trainDataRange ? `${job.trainDataRange[0]} ~ ${job.trainDataRange[1]}` : '-',
        startTime: job.startTime,
        endTime: job.endTime,
        status: job.status,
        mape: job.metrics?.mape,
        mae: job.metrics?.mae,
        rmse: job.metrics?.rmse,
        createdBy: 'admin',
        remark: job.remark,
        modelVersion: job.modelVersion,
        datasetId: job.datasetId,
        trainSampleCount: job.trainSampleCount,
        testSampleCount: job.testSampleCount
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

  useEffect(() => {
    loadDatasets()
  }, [])

  // 新建训练任务
  const handleCreateJob = async (values: any) => {
    if (submitLoading) return
    if (!values.datasetId && !activeTrainingDataset) {
      message.warning('请先在数据管理页面上传并激活训练数据集。')
      return
    }
    setSubmitLoading(true)
    try {
      message.loading('模型训练中，请勿重复提交', 0)
      
      const params = {
        modelName: values.modelName,
        algorithm: values.algorithm,
        trainDataStart: values.dataRange[0].format('YYYY-MM-DD'),
        trainDataEnd: values.dataRange[1].format('YYYY-MM-DD'),
        params: {},
        remark: values.remark,
        datasetId: values.datasetId || activeTrainingDataset?.datasetId
      }
      
      const result = await createTrainingJob(params)
      message.destroy()
      
      if (result.success) {
        let successMsg = '训练任务提交成功'
        if (result.modelVersion) {
          successMsg += `，模型版本：${result.modelVersion}`
        }
        if (result.metrics?.mape) {
          successMsg += `\nMAPE: ${result.metrics.mape.toFixed(2)}%`
        }
        message.success(successMsg)
        
        setModalVisible(false)
        form.resetFields()
        // 刷新列表
        await loadJobs()
        
        // 提示用户去模型管理页面发布
        if (result.modelVersion && result.metrics) {
          Modal.success({
            title: '训练完成',
            content: (
              <div>
                <p>模型版本：{result.modelVersion}</p>
                <p>数据集ID：{result.datasetId || params.datasetId}</p>
                <p>训练时间范围：{params.trainDataStart} ~ {params.trainDataEnd}</p>
                <p>训练样本数：{result.trainSampleCount || '-'}</p>
                <p>测试样本数：{result.testSampleCount || '-'}</p>
                {result.featureDatasetPath && <p>特征数据路径：{result.featureDatasetPath}</p>}
                {result.trainDatasetPath && <p>训练集路径：{result.trainDatasetPath}</p>}
                {result.testDatasetPath && <p>测试集路径：{result.testDatasetPath}</p>}
                <hr />
                {result.metrics.mape && <p>MAPE：{result.metrics.mape.toFixed(2)}%</p>}
                {result.metrics.mae && <p>MAE：{result.metrics.mae.toFixed(2)}</p>}
                {result.metrics.rmse && <p>RMSE：{result.metrics.rmse.toFixed(2)}</p>}
                {result.metrics.r2 && <p>R²：{result.metrics.r2.toFixed(4)}</p>}
                <hr />
                <p>模型已注册为候选，请进入模型管理页面并点击刷新模型列表查看。</p>
              </div>
            )
          })
        }
      }
    } catch (error: any) {
      message.destroy()
      const errorDetail = error?.response?.data?.detail || error.message
      if (errorDetail.includes('No training data found in selected date range')) {
        message.error('所选日期范围内没有可训练数据，请重新选择日期范围。')
      } else {
        message.error(`训练失败：${errorDetail}`)
      }
      console.error(error)
      await loadJobs()
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCloseCreateModal = () => {
    if (submitLoading) {
      message.warning('模型训练中，请等待完成')
      return
    }
    setModalVisible(false)
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
        let displayName = ''
        let color = 'blue'
        if (alg === 'lightgbm') {
          displayName = 'LightGBM'
          color = 'purple'
        } else if (alg === 'xgboost') {
          displayName = 'XGBoost'
          color = 'orange'
        } else if (alg === 'random_forest') {
          displayName = 'RandomForest'
        }
        return <Tag color={color}>{displayName}</Tag>
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
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 140,
      render: (val) => val || '-'
    },
    {
      title: '数据集ID',
      dataIndex: 'datasetId',
      key: 'datasetId',
      width: 120,
      render: (val) => val || '-'
    },
    {
      title: '训练样本数',
      dataIndex: 'trainSampleCount',
      key: 'trainSampleCount',
      width: 110,
      align: 'right',
      render: (val) => val ?? '-'
    },
    {
      title: '测试样本数',
      dataIndex: 'testSampleCount',
      key: 'testSampleCount',
      width: 110,
      align: 'right',
      render: (val) => val ?? '-'
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { loadDatasets(); setModalVisible(true) }} disabled={submitLoading}>
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
            <Option value="xgboost">XGBoost</Option>
            <Option value="lightgbm">LightGBM</Option>
            <Option value="random_forest">RandomForest</Option>
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
        onCancel={handleCloseCreateModal}
        maskClosable={!submitLoading}
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
            <RangePicker
              style={{ width: '100%' }}
              disabledDate={disabledTrainingDate}
            />
          </Form.Item>

          <Form.Item
           name="datasetId"
           label="训练数据集"
           rules={[{ required: true, message: '请选择训练数据集' }]}
         >
           <Select
             placeholder="请选择训练数据集"
             loading={loading}
             onChange={(datasetId) => {
               const dataset = trainingDatasets.find(d => d.datasetId === datasetId)
               const range = getDatasetDateRange(dataset)
               if (range) {
                 form.setFieldsValue({ dataRange: range })
               }
             }}
           >
             {trainingDatasets.map(dataset => (
               <Option key={dataset.datasetId} value={dataset.datasetId}>
                 {dataset.isActive ? '【当前激活】' : ''}{dataset.fileName} / {dataset.rowCount} 行 / {dataset.datasetId}
               </Option>
             ))}
           </Select>
         </Form.Item>
         
         {/* Show dataset date range info */}
         <div style={{ marginBottom: 16 }}>
           {(() => {
             const datasetId = form.getFieldValue("datasetId")
             const dataset = trainingDatasets.find(d => d.datasetId === datasetId) || activeTrainingDataset
             if (!dataset) return null
             
             const start = dataset.preparedDateStart || dataset.dateStart
             const end = dataset.preparedDateEnd || dataset.dateEnd
             
             if (!start || !end) {
               return (
                 <Alert
                   message="该数据集未识别到日期范围，请先执行数据准备或检查 date 字段。"
                   type="warning"
                   showIcon
                 />
               )
             }
             
             return (
               <div style={{ color: '#666', fontSize: '13px' }}>
                 当前数据范围：{start} ~ {end}
               </div>
             )
           })()}
         </div>
         
         {!activeTrainingDataset && (
            <Alert
              message="请先在数据管理页面上传并激活训练数据集。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

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

          <Alert message="模型训练当前为同步执行，提交后请等待完成，请勿重复提交" type="info" showIcon style={{ marginBottom: 16 }} />
          {submitLoading && (
            <Alert
              type="warning"
              showIcon
              icon={<Spin size="small" />}
              message="模型训练正在执行，当前为同步训练，请勿关闭页面或重复提交。"
              style={{ marginBottom: 16 }}
            />
          )}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseCreateModal} disabled={submitLoading}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitLoading} disabled={submitLoading}>提交任务</Button>
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
