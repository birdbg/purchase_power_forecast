import React from 'react'
import { Form, Input, Select, Switch, Slider, Button, Card, Alert, Typography, Space, message, Row, Col, InputNumber } from 'antd'
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons'

const { Title } = Typography
const { Option } = Select
const { Item: FormItem } = Form

interface ConfigFormValues {
  defaultAlgorithm: 'XGBoost' | 'LightGBM' | 'RandomForest'
  trainSetRatio: number
  enableAutoTuning: boolean
  nTrials: number
  maxAllowedMape: number
  maxAllowedPeakMape: number
  minImprovementRatio: number
  inferenceDataPath: string
  predictionSavePath: string
  enableFeatureSnapshot: boolean
  modelStorePath: string
  enableAutoPublish: boolean
  keepAllHistoryModels: boolean
}

const SystemConfig: React.FC = () => {
  const [form] = Form.useForm<ConfigFormValues>()

  // 表单初始值
  const initialValues: ConfigFormValues = {
    defaultAlgorithm: 'RandomForest',
    trainSetRatio: 0.8,
    enableAutoTuning: true,
    nTrials: 100,
    maxAllowedMape: 5,
    maxAllowedPeakMape: 7,
    minImprovementRatio: 1,
    inferenceDataPath: './data/inference_input',
    predictionSavePath: './data/prediction_output',
    enableFeatureSnapshot: true,
    modelStorePath: './model_store/purchase_power',
    enableAutoPublish: false,
    keepAllHistoryModels: true
  }

  // 保存配置
  const handleSave = () => {
    form.validateFields()
      .then(values => {
        // 模拟保存
        console.log('保存的配置：', values)
        message.success('系统配置保存成功')
      })
      .catch(errorInfo => {
        console.log('表单验证失败：', errorInfo)
        message.error('表单验证失败，请检查输入')
      })
  }

  // 重置表单
  const handleReset = () => {
    form.resetFields()
    message.info('表单已重置为默认值')
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>系统配置</Title>

      <Form
        form={form}
        initialValues={initialValues}
        layout="vertical"
      >
        {/* 模型训练配置 */}
        <Card title="模型训练配置" bordered={false} style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12} md={6}>
              <FormItem
                label="默认算法"
                name="defaultAlgorithm"
                rules={[{ required: true, message: '请选择默认算法' }]}
              >
                <Select>
                  <Option value="XGBoost">XGBoost</Option>
                  <Option value="LightGBM">LightGBM</Option>
                  <Option value="RandomForest">RandomForest</Option>
                </Select>
              </FormItem>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormItem
                label="训练集比例"
                name="trainSetRatio"
                rules={[
                  { required: true, message: '请输入训练集比例' },
                  { type: 'number', min: 0.5, max: 0.95, message: '比例范围为 0.5 ~ 0.95' }
                ]}
              >
                <Slider
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  marks={{
                    0.5: '0.5',
                    0.7: '0.7',
                    0.8: '0.8',
                    0.95: '0.95'
                  }}
                />
              </FormItem>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormItem
                label="是否启用自动调参"
                name="enableAutoTuning"
                valuePropName="checked"
              >
                <Switch />
              </FormItem>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormItem
                label="自动调参次数(n_trials)"
                name="nTrials"
                rules={[
                  { required: true, message: '请输入调参次数' },
                  { type: 'number', min: 10, max: 1000, message: '次数范围为 10 ~ 1000' }
                ]}
              >
                <InputNumber min={10} max={1000} style={{ width: '100%' }} />
              </FormItem>
            </Col>
          </Row>
        </Card>

        {/* 评估阈值配置 */}
        <Card title="评估阈值配置" bordered={false} style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={8}>
              <FormItem
                label="最大允许 MAPE(%)"
                name="maxAllowedMape"
                rules={[
                  { required: true, message: '请输入最大允许 MAPE' },
                  { type: 'number', min: 1, max: 20, message: '范围为 1 ~ 20' }
                ]}
              >
                <InputNumber min={1} max={20} step={0.1} suffix="%" style={{ width: '100%' }} />
              </FormItem>
            </Col>
            <Col xs={24} sm={8}>
              <FormItem
                label="最大允许峰值 MAPE(%)"
                name="maxAllowedPeakMape"
                rules={[
                  { required: true, message: '请输入最大允许峰值 MAPE' },
                  { type: 'number', min: 2, max: 30, message: '范围为 2 ~ 30' }
                ]}
              >
                <InputNumber min={2} max={30} step={0.1} suffix="%" style={{ width: '100%' }} />
              </FormItem>
            </Col>
            <Col xs={24} sm={8}>
              <FormItem
                label="新模型相对旧模型最小提升比例(%)"
                name="minImprovementRatio"
                rules={[
                  { required: true, message: '请输入最小提升比例' },
                  { type: 'number', min: 0.1, max: 20, message: '范围为 0.1 ~ 20' }
                ]}
              >
                <InputNumber min={0.1} max={20} step={0.1} suffix="%" style={{ width: '100%' }} />
              </FormItem>
            </Col>
          </Row>
        </Card>

        {/* 推理配置 */}
        <Card title="推理配置" bordered={false} style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <FormItem
                label="推理数据路径"
                name="inferenceDataPath"
                rules={[{ required: true, message: '请输入推理数据路径' }]}
              >
                <Input placeholder="请输入路径" />
              </FormItem>
            </Col>
            <Col xs={24} sm={12}>
              <FormItem
                label="预测结果保存路径"
                name="predictionSavePath"
                rules={[{ required: true, message: '请输入预测结果保存路径' }]}
              >
                <Input placeholder="请输入路径" />
              </FormItem>
            </Col>
            <Col xs={24} sm={12}>
              <FormItem
                label="是否记录输入特征快照"
                name="enableFeatureSnapshot"
                valuePropName="checked"
              >
                <Switch />
              </FormItem>
            </Col>
          </Row>
        </Card>

        {/* 模型版本配置 */}
        <Card title="模型版本配置" bordered={false} style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12}>
              <FormItem
                label="模型存储路径"
                name="modelStorePath"
                rules={[{ required: true, message: '请输入模型存储路径' }]}
              >
                <Input placeholder="请输入路径" />
              </FormItem>
            </Col>
            <Col xs={24} sm={12}>
              <FormItem
                label="是否允许自动发布"
                name="enableAutoPublish"
                valuePropName="checked"
              >
                <Switch />
              </FormItem>
            </Col>
            <Col xs={24} sm={12}>
              <FormItem
                label="是否保留所有历史模型"
                name="keepAllHistoryModels"
                valuePropName="checked"
              >
                <Switch />
              </FormItem>
            </Col>
          </Row>
        </Card>

        {/* 操作按钮 */}
        <div style={{ marginBottom: 24 }}>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} size="large">
              保存配置
            </Button>
            <Button icon={<RollbackOutlined />} onClick={handleReset} size="large">
              重置默认值
            </Button>
          </Space>
        </div>

        {/* 页面底部提示 */}
        <Alert
          message="注意事项"
          description="生产环境不建议自动发布模型，应人工审核模型效果和数据后再上线。"
          type="warning"
          showIcon
        />
      </Form>
    </div>
  )
}

export default SystemConfig
