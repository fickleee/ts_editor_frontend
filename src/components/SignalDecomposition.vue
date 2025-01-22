<template>
  <!-- 整体容器：使用flex布局，设置高度为视口高度的40% -->
  <div class="flex flex-col gap-4 h-[40vh]">
    <!-- 顶部日期选择器区域 -->
    <div class="flex items-center gap-2 h-[5vh]">
      <span class="text-sm text-gray-600">Select Date:</span>
      <!-- Element Plus日期选择器组件 -->
      <el-date-picker
        v-model="selectedDate"
        type="date"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        size="small"
        :prefix-icon="Calendar"
        class="w-[180px] [&_.el-input__wrapper]:p-2 [&_.el-input__prefix]:text-sm"
        @change="handleDateChange"
      />
    </div>

    <!-- 图表展示区域：使用flex布局管理三个图表 -->
    <div class="flex-1 flex flex-col justify-between">
      <!-- 原始信号图表 -->
      <div class="relative h-[30%] border-purple-900 border-2 rounded-lg">
        <!-- 标签：使用绝对定位放置在图表左上角 -->
        <div class="absolute -top-3 left-2">
          <div class="bg-gradient-to-r from-purple-600 to-purple-400 text-white text-sm px-4 py-0.5 rounded">
            Original
          </div>
        </div>
        <!-- 图表容器 -->
        <div class="h-full pt-2">
          <LineChart 
            :data="originalSignal"
            color="#41B883"
          />
        </div>
      </div>

      <!-- 分解信号图表区域 -->
      <div class="flex flex-col justify-between h-[65%] gap-4">
        <!-- 低频信号图表 -->
        <div class="relative h-[45%] border-purple-900 border-2 rounded-lg">
          <div class="absolute -top-3 left-2">
            <div class="bg-gradient-to-r from-purple-600 to-purple-400 text-white text-sm px-4 py-0.5 rounded">
              LF
            </div>
          </div>
          <div class="h-full pt-2">
            <LineChart 
              :data="lowFrequencySignal"
              color="#41B883"
            />
          </div>
        </div>
        
        <!-- 高频信号图表 -->
        <div class="relative h-[45%] border-purple-900 border-2 rounded-lg">
          <div class="absolute -top-3 left-2">
            <div class="bg-gradient-to-r from-purple-600 to-purple-400 text-white text-sm px-4 py-0.5 rounded">
              HF
            </div>
          </div>
          <div class="h-full pt-2">
            <LineChart 
              :data="highFrequencySignal"
              color="#FF69B4"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 加载遮罩层 -->
    <div 
      v-loading="signalStore.loading" 
      class="absolute inset-0 bg-white/70 z-50 hidden [&[v-loading]]:block"
    ></div>
  </div>
</template>

<script setup>
// 导入所需的Vue组件和工具
import { ref, onMounted, watch } from 'vue'
import { useSignalStore } from '@/store/signalStore'
import { storeToRefs } from 'pinia'
import LineChart from './LineChart.vue'
import { Calendar } from '@element-plus/icons-vue'

// 初始化信号Store
const signalStore = useSignalStore()
// 解构需要的响应式数据
const { 
  originalSignal,
  lowFrequencySignal,
  highFrequencySignal
} = storeToRefs(signalStore)

// 设置默认日期
const selectedDate = ref('2006-12-17')

// 日期变化处理函数
const handleDateChange = (date) => {
  if (date) {
    signalStore.setCurrentDate(date)
  }
}

// 监听数据变化
watch([originalSignal, lowFrequencySignal, highFrequencySignal], ([newOriginal, newLow, newHigh]) => {
  console.log('Data updated:', {
    original: newOriginal,
    low: newLow,
    high: newHigh
  })
}, { deep: true })

// 组件挂载时获取数据
onMounted(async () => {
  console.log('Component mounted, fetching data...')
  await signalStore.fetchDecomposedSignal(selectedDate.value)
})
</script>

