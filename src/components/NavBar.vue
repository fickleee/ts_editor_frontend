<!-- 导航栏组件 -->
<template>
  <!-- 导航栏 -->
  <nav class="h-[6.0vh] bg-white shadow-md flex items-center px-4 gap-6" 
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
    <div class="flex items-center gap-2 h-full ml-6">
      <div class="relative h-[80%] flex">
        <button 
          @click="isOpen = !isOpen"
          :style="{
            borderColor: THEME_COLOR,
            color: THEME_COLOR
          }"
          class="flex items-center justify-between w-[150px] pb-0 hover:text-purple-600 transition-colors duration-200 border-b-2"
        >
          <span class="text-base font-semibold flex-1 text-center">{{ datasetStore.getCurrentDataset || 'Select Dataset' }}</span>
          <!-- 下拉箭头 -->
          <svg 
            :style="{ color: THEME_COLOR }"
            class="h-5 w-5 transition-transform duration-200 flex-shrink-0"
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
          class="absolute top-full left-0 mt-1 w-[150px] bg-white rounded-lg shadow-lg py-1 z-10"
        >
          <button 
            v-for="option in datasets" 
            :key="option"
            @click="selectDataset(option)"
            :style="{
              '--hover-color': THEME_COLOR
            }"
            class="w-full px-4 py-2 text-center text-sm hover:text-[var(--hover-color)] text-gray-700 font-semibold"
          >
            {{ option }}
          </button>
        </div>
      </div>
    </div>
    <!-- 变量选择下拉框 (仅在 capture 数据集时显示) -->
    <div class="flex items-center gap-2 h-full" v-if="datasetStore.getCurrentDataset === 'capture'">
      <div class="relative h-[80%] flex">
        <button 
          @click="isVariableOpen = !isVariableOpen"
          :style="{
            borderColor: THEME_COLOR,
            color: THEME_COLOR
          }"
          class="flex items-center justify-between w-[60px] pb-0 hover:text-purple-600 transition-colors duration-200 border-b-2"
        >
          <span class="text-base font-semibold flex-1 text-center">{{ selectedVariable || 'x' }}</span>
          <!-- 下拉箭头 -->
          <svg 
            :style="{ color: THEME_COLOR }"
            class="h-5 w-5 transition-transform duration-200 flex-shrink-0"
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
          class="absolute top-full left-0 mt-1 w-[60px] bg-white rounded-lg shadow-lg py-1 z-10"
        >
          <button 
            v-for="option in variables" 
            :key="option"
            @click="selectVariable(option)"
            :style="{
              '--hover-color': THEME_COLOR
            }"
            class="w-full px-4 py-2 text-center text-sm hover:text-[var(--hover-color)] text-gray-700 font-semibold"
          >
            {{ option }}
          </button>
        </div>
      </div>
    </div>

    <!-- 聚合方式切换 Tab -->
    <div class="flex bg-gray-100 p-1 rounded-full" v-if="datasetStore.getCurrentDataset !== 'capture'">
      <button
        v-for="option in aggregationOptions"
        :key="option.value"
        @click="selectAggregation(option.value)"
        :style="{
          '--text-color': THEME_COLOR
        }"
        class="px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200"
        :class="[
          currentAggregation === option.value
            ? 'bg-white text-[var(--text-color)] shadow-sm'
            : 'text-gray-600 hover:text-[var(--text-color)]'
        ]"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- 工作日/周末筛选 -->
    <div class="flex items-center gap-4" v-if="datasetStore.getCurrentDataset !== 'capture'">
      <button
        @click="datasetStore.setShowWeekday(!datasetStore.getShowWeekday)"
        :style="{
          borderColor: getWeekdayButtonColor(),
          color: getWeekdayButtonColor()
        }"
        class="px-4 py-1.5 rounded-full text-base font-semibold transition-all duration-200 hover:opacity-90 border-2"
      >
        Weekday
      </button>
      <button
        @click="datasetStore.setShowWeekend(!datasetStore.getShowWeekend)"
        :style="{
          borderColor: getWeekendButtonColor(),
          color: getWeekendButtonColor()
        }"
        class="px-4 py-1.5 rounded-full text-base font-semibold transition-all duration-200 hover:opacity-90 border-2"
      >
        Weekend
      </button>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Action buttons -->
    <div class="flex gap-6 mr-6">
      <button
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white  text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        :disabled="!timeSeriesStore.canUndo"
        @click="timeSeriesStore.undo"
        title="Undo"
      >
        <img src="@/assets/undo.svg" alt="Undo" class="w-10 h-10" />
      </button>

      <button
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white  text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        :disabled="!timeSeriesStore.canRedo"
        @click="timeSeriesStore.redo"
        title="Redo"
      >
        <img src="@/assets/redo.svg" alt="Redo" class="w-10 h-10" />
      </button>

      <button
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white  text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        :disabled="true"
        title="Export"
      >
        <img src="@/assets/export.svg" alt="Export" class="w-10 h-10" />
      </button>

      <!-- 添加同步按钮 -->
      <button
        @click="handleSyncClick"
        class="ml-3 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        title="同步数据到左侧"
      >
        Syn
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { BORDER_WIDTH, BORDER_COLOR, THEME_COLOR, WEEKDAY_COLOR, WEEKEND_COLOR } from '../utils/constants';
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
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' }
];

// 当前选中的聚合方式
const currentAggregation = ref('day');

// 切换聚合方式 (仅更新UI状态，不触发实际功能)
const selectAggregation = (value) => {
  currentAggregation.value = value;
  // 不触发任何实际的聚合功能
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

// 工作日按钮颜色
const getWeekdayButtonColor = () => {
  if (datasetStore.getShowWeekday) {
      return WEEKDAY_COLOR;
  }
  // 未选中时使用灰色
  return '#E5E5E5';
};

// 周末按钮颜色
const getWeekendButtonColor = () => {
  if (datasetStore.getShowWeekend) {
    return WEEKEND_COLOR;
  }
  // 未选中时使用灰色
  return '#E5E5E5';
};

// 获取所有 origin 类型的曲线数据
const getOriginSeriesData = () => {
  return timeSeriesStore.series.filter(s => s.type === 'original');
};

// 同步按钮点击处理函数
const handleSyncClick = () => {
  // 获取所有 origin 曲线
  const originSeries = getOriginSeriesData();
  
  if (!originSeries.length) {
    console.warn('没有找到 origin 类型的时间序列数据');
    return;
  }
  
  // 转换数据格式
  const formattedData = originSeries.map(series => {
    // 从ID中提取日期和用户ID
    let dateStr = '';
    let userId = series.id; // 默认保持原始ID
    
    // 检查ID是否符合 user_XX_YYYY-MM-DD 格式
    const idMatch = series.id.match(/^(user_(\d+))_(\d{4}-\d{2}-\d{2})$/);
    if (idMatch) {
      userId = parseInt(idMatch[2], 10); // 提取数字部分并转换为数字类型
      dateStr = idMatch[3]; // 提取YYYY-MM-DD部分
    } else if (series.data && series.data.length > 0) {
      // 如果ID不符合特定格式，尝试从数据中提取日期
      const firstTimeStr = series.data[0].time;
      if (typeof firstTimeStr === 'string' && firstTimeStr.includes(' ')) {
        dateStr = firstTimeStr.split(' ')[0];
      } else if (typeof firstTimeStr === 'string' && firstTimeStr.includes('-')) {
        dateStr = firstTimeStr;
      } else {
        // 使用当前日期作为默认值
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      
      // 尝试从ID中提取纯数字部分（如果ID是user_XX格式）
      const userIdMatch = series.id.match(/^user_(\d+)$/);
      if (userIdMatch) {
        userId = parseInt(userIdMatch[1], 10); // 提取数字部分并转换为数字类型
      }
    }
    
    // 转换数据点格式
    const formattedPoints = series.data.map(point => {
      // 处理不同格式的时间
      let timeStr = '';
      if (typeof point.time === 'string') {
        // 如果时间是字符串格式
        if (point.time.includes(' ')) {
          // 如果包含空格，则是完整日期时间
          timeStr = point.time;
        } else if (!isNaN(point.time)) {
          // 如果是数字格式（小时），转换为时间字符串
          const hours = Math.floor(point.time);
          const minutes = Math.round((point.time - hours) * 60);
          timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        } else {
          // 已经是时间格式
          timeStr = point.time;
        }
      } else if (typeof point.time === 'number') {
        // 如果时间是数字（小时），转换为时间字符串
        const hours = Math.floor(point.time);
        const minutes = Math.round((point.time - hours) * 60);
        timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      }
      
      return {
        time: timeStr,
        value: point.value
      };
    });
    
    return {
      id: userId, // 现在userId是数字类型
      date: dateStr,
      data: formattedPoints
    };
  });
  
  // 更新到 store 以传递给左侧组件
  timeSeriesStore.updateEditedSeriesData(formattedData);
  
  // 打印到控制台
  console.log('同步到左侧的数据:', formattedData);
};
</script> 