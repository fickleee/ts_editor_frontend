<script setup>
import TimeSeriesEditor from './TimeSeriesEditor.vue';
import { ref } from 'vue';
import { THEME_COLOR, THEME_COLOR_LIGHT } from '@/utils/constants';
import { useDatasetStore } from '../stores/datasetStore';

const datasetStore = useDatasetStore();
const isDragging = ref(false);
const isDragOver = ref(false);

const handleDragEnter = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  isDragging.value = true;
  isDragOver.value = true;
};

const handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // 确保鼠标真的离开了元素而不是进入了子元素
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    isDragOver.value = false;
  }
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  // 确保在拖拽过程中保持 isDragOver 为 true
  if (!isDragOver.value) {
    isDragOver.value = true;
  }
};

const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  isDragOver.value = false;
  isDragging.value = false;

  // 从 originalData 中筛选数据
  const originalData = datasetStore.getOriginalData;
  if (!originalData || !originalData.length) {
    console.warn('No original data found in store');
    return;
  }

  // 从 MatrixChart 组件传递的数据中获取 userId 和 weekday
  const draggedData = window.__draggedData;
  if (!draggedData) {
    console.warn('No dragged data found');
    return;
  }

  const { userId, weekday } = draggedData;
  
  // 找到对应用户的数据
  const userData = originalData.find(user => user.id === userId);
  if (!userData || !userData.data) {
    console.warn('User data not found:', userId);
    return;
  }

  // 筛选出该用户在特定工作日的所有数据
  const filteredData = userData.data.filter((point) => {
    if (!point || !point.time) return false;
    const date = new Date(point.time);
    return date.getDay() === weekday;
  });

  // 按天分组数据
  const groupedByDay = {};
  filteredData.forEach(point => {
    // 直接从时间字符串中切分日期和时间
    const [date, time] = point.time.split(' ');
    
    if (!groupedByDay[date]) {
      groupedByDay[date] = [];
    }
    
    groupedByDay[date].push({
      time: time,
      value: point.value
    });
  });

  // 转换为目标格式
  const trans_data = Object.entries(groupedByDay).map(([date, data]) => ({
    id: userId,
    date: date,
    data: data.sort((a, b) => a.time.localeCompare(b.time)) // 按时间排序
  }));

 // TODO: 将转换后的数据传递给 TimeSeriesEditor 组件
  if (trans_data.length > 0) {
    // 在全局事件总线上触发一个事件以传递数据到 TimeSeriesEditor
    window.dispatchEvent(new CustomEvent('add-time-series', { 
      detail: trans_data 
    }));
  }
};

// 添加全局事件监听
if (typeof window !== 'undefined') {
  window.addEventListener('dragend', () => {
    isDragging.value = false;
    isDragOver.value = false;
  });
}
</script>

<template>
  <div 
    class="h-full edit-view relative"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div 
      v-show="isDragging"
      class="absolute inset-0 z-50 bg-black/20 backdrop-blur-[2px] flex items-center justify-center"
    >
      <div 
        :style="{
          '--theme-color': THEME_COLOR,
          '--theme-color-light': THEME_COLOR_LIGHT,
          borderColor: isDragOver ? 'var(--theme-color)' : '#9ca3af'
        }"
        class="w-[90%] max-w-[800px] h-[300px] border-4 border-dashed rounded-2xl flex items-center justify-center bg-white/30 backdrop-blur-sm transition-colors duration-200"
      >
        <span 
          :style="{
            color: isDragOver ? 'var(--theme-color)' : '#4b5563'
          }"
          class="text-3xl font-medium transition-colors duration-200"
        >
          drag data here to edit
        </span>
      </div>
    </div>
    <TimeSeriesEditor />
  </div>
</template>

<style scoped>
.edit-view {
  min-height: 200px;
}
</style>