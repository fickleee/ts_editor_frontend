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
      <!-- 添加同步按钮 -->
      <button
        @click="handleSyncClick"
        :disabled="isUpdating"
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        title="sync"
      >
        <img src="@/assets/sync.svg" alt="Sync" class="w-10 h-10" />
      </button>

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
        class="w-10 h-10 rounded-lg flex items-center justify-center bg-white  text-gray-600 hover:bg-gray-50"
        @click="exportEditHistory"
        title="Export Edit History"
      >
        <img src="@/assets/export.svg" alt="Export" class="w-10 h-10" />
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { BORDER_WIDTH, BORDER_COLOR, THEME_COLOR, WEEKDAY_COLOR, WEEKEND_COLOR } from '../utils/constants';
import { useDatasetStore } from '../stores/datasetStore';
import { useTimeSeriesStore } from '../stores/timeSeriesStore';
import { ElMessage } from 'element-plus';

const datasetStore = useDatasetStore();
const timeSeriesStore = useTimeSeriesStore();
const isOpen = ref(false);
const isVariableOpen = ref(false);
const datasets = ['step', 'electricity', 'capture'];
const variables = ['x', 'y', 'z'];
const selectedVariable = ref('x');
const isUpdating = ref(false);

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
  // 如果切换到非 capture 数据集，重置变量选择
  if (dataset !== 'capture') {
    selectedVariable.value = 'x';
  }
  else{
    datasetStore.setShowWeekday(true);
    datasetStore.setShowWeekend(true);
  }
  datasetStore.setDataset(dataset);
  isOpen.value = false;
  

};

// 选择变量
const selectVariable = (variable) => {
  selectedVariable.value = variable;
  isVariableOpen.value = false;
  // 触发事件，通知相关组件变量已更改
  datasetStore.setSelectedVariable(variable);
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
  window.addEventListener('matrix-loading-changed', handleLoadingChanged);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('matrix-loading-changed', handleLoadingChanged);
});

// 处理loading状态变化
const handleLoadingChanged = (event) => {
  const { loading } = event.detail;
  if (loading === false) {
    isUpdating.value = false;
  }
};

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
  // 立即设置更新中状态为true并触发loading状态
  isUpdating.value = true;
  
  // 立即发送loading事件，而不是等待updateEditedDataFromTrans
  window.dispatchEvent(new CustomEvent('matrix-loading-changed', {
    detail: { loading: true }
  }));
  
  // 使用setTimeout让UI有机会先渲染loading状态，再执行数据处理
  setTimeout(() => {
    try {
      // 获取所有 origin 曲线
      const originSeries = getOriginSeriesData();
      
      if (!originSeries.length) {
        console.warn('没有找到 origin 类型的时间序列数据');
        isUpdating.value = false;
        
        // 关闭loading状态
        window.dispatchEvent(new CustomEvent('matrix-loading-changed', {
          detail: { loading: false }
        }));
        return;
      }
      
      // 转换数据格式为 transData 格式
      const transData = originSeries.map(series => {
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
      timeSeriesStore.updateEditedSeriesData(transData);
      // 设置传输数据并更新编辑后的数据
      datasetStore.setTransData(transData);
      datasetStore.updateEditedDataFromTrans();
      
    } catch (error) {
      console.error('同步数据时发生错误:', error);
      ElMessage.error('Failed to synchronize data');
      
      // 错误时立即重置状态
      isUpdating.value = false;
      window.dispatchEvent(new CustomEvent('matrix-loading-changed', {
        detail: { loading: false }
      }));
    }
  }, 0);
};

// 修改导出编辑历史函数
const exportEditHistory = () => {
  const history = timeSeriesStore.exportEditHistory();
  
  // 格式化为新的数据结构
  const formattedOperations = history.operations.map(op => {
    // 从操作的第一个seriesId中提取用户ID和日期
    let userId = '';
    let dateStr = '';
    
    if (op.seriesIds && op.seriesIds.length > 0) {
      const seriesId = op.seriesIds[0];
      
      // 尝试各种可能的ID格式模式匹配
      // 匹配形如 user_34_2016-2-16 或 user34_2016-2-16
      const fullMatch = seriesId.match(/^user[_]?(\d+)[_]?(\d{4}[-]?\d{1,2}[-]?\d{1,2})$/);
      // 匹配仅用户ID，如 user_34
      const userOnlyMatch = seriesId.match(/^user[_]?(\d+)$/);
      
      if (fullMatch) {
        userId = fullMatch[1]; // 提取数字部分
        dateStr = fullMatch[2]; // 提取日期部分
      } else if (userOnlyMatch) {
        userId = userOnlyMatch[1];
        dateStr = new Date().toISOString().split('T')[0]; // 使用当前日期作为后备
      } else {
        // 如果不匹配预期格式，保留原始ID
        userId = seriesId;
        dateStr = new Date().toISOString().split('T')[0]; // 使用当前日期作为后备
      }
    }
    
    // 将操作时间范围转换为HH:MM格式（精度设置为分钟）
    let startTime = "00:00";
    let endTime = "00:00";
    
    if (op.timeRange) {
      startTime = convertDecimalHoursToHHMM(op.timeRange.start);
      endTime = convertDecimalHoursToHHMM(op.timeRange.end);
    }
    
    // 格式化日期时间
    const timestamp = new Date(op.timestamp);
    const formattedDateTime = timestamp.toISOString().replace('T', ' ').substring(0, 19);
    
    // 提取操作前后的值
    let valuesBefore = [];
    let valuesAfter = [];
    
    if (op.beforeData && op.afterData && op.seriesIds && op.seriesIds.length > 0) {
      const seriesId = op.seriesIds[0];
      
      if (op.beforeData[seriesId] && op.timeRange) {
        // 过滤出时间范围内的值
        valuesBefore = op.beforeData[seriesId]
          .filter(point => point && point.time >= op.timeRange.start && point.time <= op.timeRange.end)
          .map(point => point.value);
      }
      
      if (op.afterData[seriesId] && op.timeRange) {
        valuesAfter = op.afterData[seriesId]
          .filter(point => point && point.time >= op.timeRange.start && point.time <= op.timeRange.end)
          .map(point => point.value);
      }
    }
    
    // 构建结果对象
    const result = {
      id: userId,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
      operation: op.type,
      value_before_edit: valuesBefore,
      value_after_edit: valuesAfter
    };
    
    // 针对move-x操作，记录移动后的区间范围
    if (op.type === 'move-x' && op.params && op.params.offset && op.timeRange) {
      const movedStart = op.timeRange.start + op.params.offset.x;
      const movedEnd = op.timeRange.end + op.params.offset.x;
      
      result.after_move_start_time = convertDecimalHoursToHHMM(movedStart);
      result.after_move_end_time = convertDecimalHoursToHHMM(movedEnd);
    }
    
    return result;
  });
  
  // 过滤掉没有前后值数据的操作记录
  const validOperations = formattedOperations.filter(
    op => op.value_before_edit.length > 0 || op.value_after_edit.length > 0
  );
  
  // 转换为JSON字符串
  const historyJson = JSON.stringify(validOperations, null, 2);
  
  // 创建下载
  const blob = new Blob([historyJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // 创建下载链接
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-series-edit-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  
  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  
  ElMessage.success('编辑历史已成功导出');
};

// 添加辅助函数：将小数形式的小时转换为HH:MM格式（精度为分钟）
const convertDecimalHoursToHHMM = (decimalHours) => {
  if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours)) {
    return "00:00";
  }
  
  // 确保输入在0-24小时范围内
  decimalHours = Math.max(0, Math.min(24, decimalHours));
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  
  // 格式化为两位数
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
};
</script> 