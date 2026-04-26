import React, { useState, useEffect } from 'react'
import { Layout, Menu, Typography, Space, Tag } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  PlayCircleOutlined,
  DeploymentUnitOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  SettingOutlined,
  CloudServerOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'))
  // 模拟当前生产模型版本
  const productionModel = { version: 'v1.2.0', id: 'random_forest_20260426_205819' }

  // 实时更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '系统总览',
    },
    {
      key: '/training',
      icon: <PlayCircleOutlined />,
      label: '训练执行',
    },
    {
      key: '/models',
      icon: <DeploymentUnitOutlined />,
      label: '模型管理',
    },
    {
      key: '/evaluation',
      icon: <BarChartOutlined />,
      label: '模型评估',
    },
    {
      key: '/prediction',
      icon: <LineChartOutlined />,
      label: '预测监控',
    },
    {
      key: '/data',
      icon: <DatabaseOutlined />,
      label: '数据管理',
    },
    {
      key: '/config',
      icon: <SettingOutlined />,
      label: '系统配置',
    },
  ]

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 20,
            color: '#fff',
            fontSize: collapsed ? 18 : 16,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {collapsed ? '预测平台' : '外购电预测平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none', paddingTop: 16 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            lineHeight: '64px'
          }}
        >
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            外购电预测模型管理平台
          </Title>
          <Space size="large">
            <Space>
              <CloudServerOutlined style={{ color: '#52c41a' }} />
              <Text>当前生产模型：</Text>
              <Tag color="success">{productionModel.version}</Tag>
            </Space>
            <Text type="secondary">{currentTime}</Text>
          </Space>
        </Header>
        <Content
          style={{
            margin: '24px',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
