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

    <!-- Spacer:  This is important to push the buttons to the right -->
    <div class="flex-1"></div>

    <!-- Action buttons (Import, Export, Undo, Redo) -->
    <div class="flex gap-2">
      <!-- <button
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
        @click="handleImportData"
        title="Import Data"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8L12 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 13L12 16L9 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 16.7428C21.2215 15.734 22 14.2079 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Import
      </button>

      <button
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
        @click="exportAllSeries"
        title="Export All Series"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 16L12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 13L12 16L15 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 16.7428C21.2215 15.734 22 14.2079 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 16L12 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Export
      </button> -->

      <button
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        :disabled="!timeSeriesStore.canUndo"
        @click="timeSeriesStore.undo"
        title="Undo"
      >
        <img src="@/assets/undo.svg" alt="Undo" class="w-10 h-10" />
      </button>

      <button
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        :disabled="!timeSeriesStore.canRedo"
        @click="timeSeriesStore.redo"
        title="Redo"
      >
        <img src="@/assets/redo.svg" alt="Redo" class="w-10 h-10" />
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { BORDER_WIDTH, BORDER_COLOR } from '../utils/constants';
import { useDatasetStore } from '../stores/datasetStore';
import { useTimeSeriesStore } from '../stores/timeSeriesStore';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../services/api';
import { downloadCSV } from '../utils/csvUtils';

const datasetStore = useDatasetStore();
const timeSeriesStore = useTimeSeriesStore();
const isOpen = ref(false);
const datasets = ['step', 'electricity'];

const selectDataset = (dataset) => {
  datasetStore.setDataset(dataset);
  isOpen.value = false;
};

// Import Data handler
const handleImportData = async () => {
  try {
    const result = await ElMessageBox.prompt('Enter date (YYYY-MM-DD)', 'Import Data', {
      confirmButtonText: 'Import',
      cancelButtonText: 'Cancel',
      inputPattern: /^\d{4}-\d{2}-\d{2}$/,
      inputErrorMessage: 'Invalid date format. Use YYYY-MM-DD'
    });

    const date = result.value;
    const data = await api.importData(date);
    timeSeriesStore.importData([{
      id: `imported_${date}`,
      data,
      type: 'original',
      visible: true
    }]);
    ElMessage.success('Data imported successfully');

  } catch (error) {
    if (error.action !== 'cancel') {
      console.error('Error importing data:', error);
      ElMessage.error('Failed to import data');
    }
  }
};

// Export All Series handler
const exportAllSeries = () => {
  timeSeriesStore.series.forEach(series => {
    if (series.visible) {
      downloadCSV(series.data, `${series.id}_export.csv`);
    }
  });
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