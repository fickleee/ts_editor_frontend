<!-- 导航栏组件 -->
<template>
  <!-- 导航栏 -->
  <nav class="h-[6.0vh] bg-white shadow-md flex items-center px-4 gap-4" 
    :style="{
      borderBottomWidth: `${BORDER_WIDTH}px`,
      borderColor: BORDER_COLOR
    }"
  >
    <!-- Logo -->
    <img 
      src="../assets/TimeSeries Editor.svg" 
      alt="Time Series Editor" 
      class="h-[2vh] w-auto"
    />
    
    <!-- 数据集选择下拉框 -->
    <div class="relative">
      <button 
        @click="isOpen = !isOpen"
        class="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors duration-200"
      >
        <span class="text-sm font-medium">{{ datasetStore.getCurrentDataset || 'Select Dataset' }}</span>
        <!-- 下拉箭头 -->
        <svg 
          class="h-4 w-4 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- 下拉菜单 -->
      <div 
        v-if="isOpen"
        class="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg py-1 z-10"
      >
        <button 
          v-for="option in datasets" 
          :key="option"
          @click="selectDataset(option)"
          class="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-600"
        >
          {{ option }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { BORDER_WIDTH, BORDER_COLOR } from '../utils/constants';
import { useDatasetStore } from '../stores/datasetStore';

const datasetStore = useDatasetStore();
const isOpen = ref(false);
const datasets = ['step', 'electricity'];

const selectDataset = (dataset) => {
  datasetStore.setDataset(dataset);
  isOpen.value = false;
};

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (isOpen.value && !event.target.closest('.relative')) {
    isOpen.value = false;
  }
};

// 添加和移除全局点击事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script> 