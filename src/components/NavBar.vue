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

    <!-- 变量选择下拉框 (仅在 capture 数据集时显示) -->
    <div class="relative" v-if="datasetStore.getCurrentDataset === 'capture'">
      <button 
        @click="isVariableOpen = !isVariableOpen"
        class="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors duration-200"
      >
        <span class="text-sm font-medium">{{ selectedVariable || '选择变量' }}</span>
        <!-- 下拉箭头 -->
        <svg 
          class="h-4 w-4 transition-transform duration-200"
          :class="{ 'rotate-180': isVariableOpen }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- 变量下拉菜单 -->
      <div 
        v-if="isVariableOpen"
        class="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg py-1 z-10"
      >
        <button 
          v-for="option in variables" 
          :key="option"
          @click="selectVariable(option)"
          class="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-600"
        >
          {{ option }}
        </button>
      </div>
    </div>

    <!-- 聚合方式切换 Tab -->
    <div class="flex bg-gray-100 p-1 rounded-lg">
      <button
        v-for="option in aggregationOptions"
        :key="option.value"
        @click="selectAggregation(option.value)"
        class="px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200"
        :class="[
          currentAggregation === option.value
            ? 'bg-white text-purple-600 shadow-sm'
            : 'text-gray-600 hover:text-purple-600'
        ]"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Action buttons -->
    <div class="flex gap-2">
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
const isVariableOpen = ref(false);
const datasets = ['step', 'electricity', 'capture'];
const variables = ['x', 'y', 'z'];
const selectedVariable = ref('x');

// 聚合方式选项
const aggregationOptions = [
  { label: 'By Day', value: 'day' },
  { label: 'By Week', value: 'week' }
];

// 当前选中的聚合方式
const currentAggregation = ref('day');

// 切换聚合方式
const selectAggregation = (value) => {
  currentAggregation.value = value;
  // 触发事件，让 MatrixChart 组件知道聚合方式改变了
  datasetStore.setAggregationLevel(value);
};

const selectDataset = (dataset) => {
  datasetStore.setDataset(dataset);
  isOpen.value = false;
  
  // 如果切换到非 capture 数据集，重置变量选择
  if (dataset !== 'capture') {
    selectedVariable.value = 'x';
  }
};

// 选择变量
const selectVariable = (variable) => {
  selectedVariable.value = variable;
  isVariableOpen.value = false;
  // 触发事件，通知相关组件变量已更改
  datasetStore.setSelectedVariable(variable);
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
  
  // 添加变量下拉框的点击外部关闭逻辑
  if (isVariableOpen.value && !event.target.closest('.relative')) {
    isVariableOpen.value = false;
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