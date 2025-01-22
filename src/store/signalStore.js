import { defineStore } from 'pinia'
import { reqDecomposeSignal } from '@/api'

// 定义信号处理的Store
export const useSignalStore = defineStore('signal', {
  // 状态定义
  state: () => ({
    originalSignal: [], // 原始信号数据
    lowFrequencySignal: [], // 低频信号数据
    highFrequencySignal: [], // 高频信号数据
    loading: false, // 加载状态
    currentDate: '2006-12-17', // 当前选中的日期
  }),
  
  // 动作定义
  actions: {
    // 获取分解后的信号数据
    async fetchDecomposedSignal(date) {
      this.loading = true
      try {
        console.log('Fetching data for date:', date)
        const result = await reqDecomposeSignal(date || this.currentDate)
        console.log('Received data:', result)
        
        // 验证数据格式
        if (!result || !result.timestamp) {
          throw new Error('Invalid data format received from server')
        }
        
        // 转换数据格式为图表所需的结构
        this.originalSignal = result.timestamp.map((time, index) => ({
          time: new Date(time),
          value: result.original[index]
        }))
        
        this.lowFrequencySignal = result.timestamp.map((time, index) => ({
          time: new Date(time),
          value: result.low_freq[index]
        }))
        
        this.highFrequencySignal = result.timestamp.map((time, index) => ({
          time: new Date(time),
          value: result.high_freq[index]
        }))
        
        console.log('Processed data:', {
          original: this.originalSignal,
          low: this.lowFrequencySignal,
          high: this.highFrequencySignal
        })
        
      } catch (error) {
        console.error('Error fetching decomposed signal:', error)
        // 错误时清空数据
        this.originalSignal = []
        this.lowFrequencySignal = []
        this.highFrequencySignal = []
      } finally {
        this.loading = false
      }
    },
    
    // 设置当前日期并获取新数据
    setCurrentDate(date) {
      console.log('Setting new date:', date)
      this.currentDate = date
      this.fetchDecomposedSignal(date)
    }
  }
}) 