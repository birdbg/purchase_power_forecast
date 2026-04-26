import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import TrainingJobs from './pages/TrainingJobs'
import ModelManagement from './pages/ModelManagement'
import ModelEvaluation from './pages/ModelEvaluation'
import PredictionMonitor from './pages/PredictionMonitor'
import DataManagement from './pages/DataManagement'
import SystemConfig from './pages/SystemConfig'

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* 默认重定向到系统总览 */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="training" element={<TrainingJobs />} />
        <Route path="models" element={<ModelManagement />} />
        <Route path="evaluation" element={<ModelEvaluation />} />
        <Route path="prediction" element={<PredictionMonitor />} />
        <Route path="data" element={<DataManagement />} />
        <Route path="config" element={<SystemConfig />} />
        {/* 404路由 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
