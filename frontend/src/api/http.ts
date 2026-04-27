import axios from 'axios'
import { message } from 'antd'

// API开关：是否使用Mock数据，true时使用mock，false或未设置时调用真实后端
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// 创建axios实例
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    const { data } = response
    // 假设后端返回格式为 { code: number, data: any, message: string }
    if (data.code && data.code !== 200) {
      message.error(data.message || '请求失败')
      return Promise.reject(data)
    }
    return data
  },
  (error) => {
    let errorMsg = '网络请求失败'
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          errorMsg = data?.message || '请求参数错误'
          break
        case 401:
          errorMsg = '未授权，请重新登录'
          // 可以在这里跳转到登录页
          break
        case 403:
          errorMsg = '没有权限访问该资源'
          break
        case 404:
          errorMsg = '请求的资源不存在'
          break
        case 500:
          errorMsg = data?.message || '服务器内部错误'
          break
        default:
          errorMsg = `请求错误，状态码：${status}`
      }
    } else if (error.request) {
      errorMsg = '服务器无响应'
    } else {
      errorMsg = error.message
    }
    message.error(errorMsg)
    return Promise.reject(error)
  }
)

export default http
