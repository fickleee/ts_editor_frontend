<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useTimeSeriesStore } from '../stores/timeSeriesStore'
import { useDatasetStore } from '../stores/datasetStore'
import TimeSeriesChart from './TimeSeriesChart.vue'
import TimeSeriesView from './TimeSeriesView.vue'
import CurveEditor from './CurveEditor.vue'
import { ElMessage } from 'element-plus'
import { BORDER_WIDTH, BORDER_COLOR } from '../utils/constants'
import { generateHouseData } from '../utils/generateData'
import PatternChart from './PatternChart.vue'

const store = useTimeSeriesStore()

const tools = ref([
  { 
    id: 'move-x', 
    name: 'Move X',
    icon: 'move-x.svg',
    active: false 
  },
  { 
    id: 'expand', 
    name: 'Expand',
    icon: 'expand.svg',
    active: false 
  },
  { 
    id: 'move-y', 
    name: 'Move Y',
    icon: 'move-y.svg',
    active: false 
  },
  { 
    id: 'curve', 
    name: 'Curve',
    icon: 'curve.svg',
    active: false 
  },
  { 
    id: 'clone', 
    name: 'Clone',
    icon: 'clone.svg',
    active: false 
  },
  { 
    id: 'removal', 
    name: 'Removal',
    icon: 'removal.svg',
    active: false 
  }
])

const activeTool = ref(null)
const isDragging = ref(false)
const dragStartTime = ref(null)
const dragStartValue = ref(null)
const initialDragTime = ref(null)
const dragThreshold = 0.05
const isMultiSelect = ref(false)
const selections = ref([])
const dragStartPoint = ref(null)
const generatePatterns = ref([])
const selectedPattern = ref(null)
const selectedSeriesId = ref(null)
const hoveredSeriesId = ref(null)
const hoverTime = ref(null)
const selectionPending = ref(false)

const previewCurve = ref(null)

const timeAxisConfig = ref({
  marginLeft: 100,
  marginRight: 20,
  width: null
})

const cloneHighlightArea = ref(null)

const showSidePanel = computed(() => {
  return activeTool.value === 'curve' || activeTool.value === 'removal'
})

const handleChartHover = (time) => {
  hoverTime.value = time
}

const selectTool = (toolId) => {
  if (selectionPending.value) {
    ElMessage.warning('Please confirm or cancel your selection first')
    return
  }

  if (toolId === activeTool.value) {
    if (toolId === 'expand' && selections.value.length > 0) {
      store.expandTimeSeries(selections.value)
    } else if (toolId === 'removal' && store.selectedTimeRange && selectedSeriesId.value) {
      generatePatterns.value = store.findSimilarPatterns(selectedSeriesId.value)
      
      // 获取数据集并输出到控制台
      const datasetStore = useDatasetStore()
      const fullDataset = datasetStore.getOriginalData
      console.log('完整数据集:', fullDataset)
      console.log('生成的匹配模式:', generatePatterns.value)
      
      return
    } else if ((toolId === 'move-x' || toolId === 'move-y') && initialSeriesState.value) {
      const finalState = store.getSeriesSnapshot(
        selectedSeriesId.value ? [selectedSeriesId.value] : store.selectedSeries
      );
      
      store.recordBatchOperation(
        toolId, 
        selectedSeriesId.value ? [selectedSeriesId.value] : store.selectedSeries,
        { type: toolId }, 
        initialSeriesState.value, 
        finalState
      );
      
      initialSeriesState.value = null;
    }
    
    activeTool.value = null
    tools.value.forEach(tool => tool.active = false)
    isMultiSelect.value = false
    selections.value = []
    dragStartTime.value = null
    dragStartValue.value = null
    previewCurve.value = null
    selectedPattern.value = null
    store.clearPreviewSeries()
    return
  }

  if (toolId !== activeTool.value) {
    dragStartTime.value = null
    dragStartValue.value = null
    selections.value = []
    previewCurve.value = null
    selectedPattern.value = null
    store.clearPreviewSeries()
    
    if (toolId === 'move-x' || toolId === 'move-y') {
      if (store.selectedTimeRange) {
        initialSeriesState.value = store.getSeriesSnapshot(
          selectedSeriesId.value ? [selectedSeriesId.value] : store.selectedSeries
        );
      }
    }
  }

  tools.value.forEach(tool => tool.active = tool.id === toolId)
  activeTool.value = toolId

  if (toolId === 'expand') {
    isMultiSelect.value = true
  } else {
    isMultiSelect.value = false
    selections.value = []
  }

  if (toolId === 'removal' && store.selectedTimeRange && selectedSeriesId.value) {
    generatePatterns.value = store.findSimilarPatterns(selectedSeriesId.value)
  }
}

const handleChartClick = (time, value) => {
  if (!activeTool.value) {
    if (!dragStartTime.value) {
      dragStartTime.value = time
      dragStartValue.value = value
      initialDragTime.value = time
    } else {
      if (Math.abs(time - initialDragTime.value) < 0.01) {
        return
      }
      
      const timeRange = {
        start: Math.min(dragStartTime.value, time),
        end: Math.max(dragStartTime.value, time)
      }
      
      if (timeRange.end - timeRange.start < 0.1) {
        timeRange.end = timeRange.start + 0.1
      }
      
      if (selectedSeriesId.value) {
        store.setSelection(timeRange, [selectedSeriesId.value])
      } else {
        store.setSelection(timeRange, store.series.map(s => s.id))
      }
      
      dragStartTime.value = null
      dragStartValue.value = null
      initialDragTime.value = null
      selectionPending.value = true
    }
    return
  }

  switch (activeTool.value) {
    case 'clone':
      if (store.selectedTimeRange) {
        if (selectedSeriesId.value) {
          store.cloneSeries(selectedSeriesId.value, time)
          
          const { start, end } = store.selectedTimeRange
          const duration = end - start
          cloneHighlightArea.value = {
            seriesId: selectedSeriesId.value,
            start: time,
            end: time + duration
          }
          
          setTimeout(() => {
            cloneHighlightArea.value = null
          }, 1000)
        } else {
          store.selectedSeries.forEach(id => {
            store.cloneSeries(id, time)
          })
        }
      }
      break
  }
}

// 添加一个函数计算当前选择序列的值范围，并返回对应的灵敏度系数
const calculateDynamicSensitivity = (seriesId) => {
  // 默认灵敏度系数
  const defaultSensitivity = 0.001;
  const minSensitivity = 0.005;  // 最小灵敏度（精细控制）
  const maxSensitivity = 1;    // 最大灵敏度（快速调整）
  
  // 如果没有选择序列，返回默认值
  if (!seriesId) return defaultSensitivity;
  
  // 获取当前选择的序列
  const selectedSeries = store.series.find(s => s.id === seriesId);
  if (!selectedSeries || !selectedSeries.data || selectedSeries.data.length === 0) {
    return defaultSensitivity;
  }
  
  // 获取选中区域内的数据点
  const rangeData = selectedSeries.data.filter(point => {
    return point && store.selectedTimeRange &&
           point.time >= store.selectedTimeRange.start && 
           point.time <= store.selectedTimeRange.end;
  });
  
  // 如果选中区域内没有数据点，使用全部数据点
  const dataToAnalyze = rangeData.length > 0 ? rangeData : selectedSeries.data;
  
  // 计算数据值范围
  const values = dataToAnalyze.map(point => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const valueRange = maxValue - minValue;
  
  // 线性映射灵敏度系数
  // 当值范围小时使用较小系数（精细控制）
  // 当值范围大时使用较大系数（快速调整）
  
  // 设置基准范围，用于归一化计算
  const baseRange = 100;   // 基准值范围
  const baseScale = 0.001; // 基准灵敏度
  
  // 计算线性灵敏度系数
  let sensitivity;
  if (valueRange <= 0) {
    sensitivity = defaultSensitivity;
  } else {
    // 线性映射公式：灵敏度 = 基准灵敏度 * (当前范围 / 基准范围)
    sensitivity = baseScale * (valueRange / baseRange);
    
    // 限制在合理范围内
    sensitivity = Math.max(minSensitivity, Math.min(maxSensitivity, sensitivity));
  }
  
  return sensitivity;
};

const handleChartDrag = (timeRange, valueRange, dragPoint) => {
  if (!isDragging.value) return

  if (timeRange && Math.abs(timeRange.end - timeRange.start) < 0.1) {
    timeRange.end = timeRange.start + 0.1
  }

  switch (activeTool.value) {
    case 'move-x':
      if (store.selectedTimeRange) {
        const offset = dragPoint.x - (dragStartPoint.value?.x || 0)
        
        if (Math.abs(offset) < dragThreshold) {
          return
        }
        
        if (selectedSeriesId.value) {
          store.moveSeriesWithoutRecord(selectedSeriesId.value, { x: offset * 0.0005, y: 0 })
          store.setSelection({
            start: store.selectedTimeRange.start + offset * 0.0005,
            end: store.selectedTimeRange.end + offset * 0.0005
          }, [selectedSeriesId.value])
        } else {
          store.selectedSeries.forEach(id => {
            store.moveSeriesWithoutRecord(id, { x: offset * 0.0005, y: 0 })
          })
          store.setSelection({
            start: store.selectedTimeRange.start + offset * 0.0005,
            end: store.selectedTimeRange.end + offset * 0.0005
          }, store.selectedSeries)
        }
      }
      break
    case 'move-y':
      if (store.selectedTimeRange) {
        const offset = (dragStartPoint.value?.y || 0) - dragPoint.y
        
        if (Math.abs(offset) < dragThreshold) {
          return
        }
        
        if (selectedSeriesId.value) {
          const dynamicSensitivity = calculateDynamicSensitivity(selectedSeriesId.value);
          store.moveSeriesWithoutRecord(selectedSeriesId.value, { x: 0, y: offset * dynamicSensitivity })
        } else {
          store.selectedSeries.forEach(id => {
            const dynamicSensitivity = calculateDynamicSensitivity(id);
            store.moveSeriesWithoutRecord(id, { x: 0, y: offset * dynamicSensitivity })
          })
        }
      }
      break
    default:
      if (!isMultiSelect.value) {
        if (timeRange) {
          if (timeRange.end - timeRange.start < 0.1) {
            return
          }
          
          if (dragStartTime.value) {
            const currentDirection = timeRange.end > timeRange.start ? 'forward' : 'backward'
            const initialDirection = dragStartTime.value > initialDragTime.value ? 'forward' : 'backward'
            
            if (currentDirection !== initialDirection) {
              return
            }
          }
        }
        
        if (selectedSeriesId.value) {
          store.setSelection(timeRange, [selectedSeriesId.value])
        } else {
          store.setSelection(timeRange, store.series.map(s => s.id))
        }
        selectionPending.value = true
      }
      break
  }
}

const handleSelectionComplete = (newSelections) => {
  selections.value = newSelections
}

const handleCurveChange = (curve) => {
  // 保存曲线控制点
  previewCurve.value = curve
  
  // 这里可以添加预览功能，显示应用曲线后的效果
  if (selectedSeriesId.value && store.selectedTimeRange) {
    // 创建临时预览
    const previewData = generatePreviewData(selectedSeriesId.value, curve)
    // 更新预览...
  }
}

// 生成预览数据的辅助函数
const generatePreviewData = (seriesId, curve) => {
  const series = store.series.find(s => s.id === seriesId)
  if (!series || !store.selectedTimeRange) return []
  
  const { start, end } = store.selectedTimeRange
  const duration = end - start
  
  // 复制数据避免直接修改
  const previewData = JSON.parse(JSON.stringify(series.data))
  
  // 对选中范围内的每个数据点应用曲线乘数
  previewData.forEach((point, i) => {
    if (point.time >= start && point.time <= end) {
      // 计算当前点在选择范围内的相对位置（0-1）
      const relativePosition = (point.time - start) / duration
      
      // 使用曲线在该位置的 y 值作为乘数
      let multiplier = 1
      for (let j = 0; j < curve.length - 1; j++) {
        if (curve[j].x <= relativePosition && curve[j + 1].x >= relativePosition) {
          const t = (relativePosition - curve[j].x) / (curve[j + 1].x - curve[j].x)
          multiplier = curve[j].y + t * (curve[j + 1].y - curve[j].y)
          break
        }
      }
      
      // 应用乘数到原始值
      previewData[i] = {
        time: point.time,
        value: point.value * multiplier
      }
    }
  })
  
  return previewData
}

const handleCurveApply = () => {
  if (!store.selectedTimeRange || !previewCurve.value) return
  
  const currentSelection = { ...store.selectedTimeRange }
  
  if (selectedSeriesId.value) {
    store.applyCurve(selectedSeriesId.value, previewCurve.value)
    store.setSelection(currentSelection, [selectedSeriesId.value])
  } else {
    store.selectedSeries.forEach(id => {
      store.applyCurve(id, previewCurve.value)
    })
    store.setSelection(currentSelection, store.selectedSeries)
  }
  
  previewCurve.value = null
}

const handleCurveReset = () => {
  previewCurve.value = null
}

const handleGenerateSelect = (pattern) => {
  selectedPattern.value = pattern
  store.setPreviewSeries(pattern)
}

const handleGenerateApply = () => {
  if (!selectedPattern.value || !selectedSeriesId.value) return
  
  store.replaceWithPattern(selectedPattern.value, selectedSeriesId.value)
  
  selectedPattern.value = null
  store.clearPreviewSeries()
}

const handleGenerateReset = () => {
  selectedPattern.value = null
  store.clearPreviewSeries()
}

const handleDragStart = (point) => {
  isDragging.value = true
  dragStartPoint.value = point
  
  if (point && point.time) {
    initialDragTime.value = point.time
  }
}

const handleDragEnd = (event) => {
  isDragging.value = false
  dragStartPoint.value = null
  
  if (store.selectedTimeRange) {
    const { start, end } = store.selectedTimeRange
    if (Math.abs(end - start) < 0.1) {
      store.setSelection({
        start,
        end: start + 0.1
      }, store.selectedSeries)
    }
  }
  
  if (selectionPending.value) {
    const chartRect = event.target.getBoundingClientRect()
    mouseReleasePosition.value = {
      x: event.clientX - chartRect.left,
      y: event.clientY - chartRect.top
    }
    showSelectionButtons.value = true
  }
}

const handleSeriesClick = (seriesId) => {
  if (selectedSeriesId.value === seriesId) {
    selectedSeriesId.value = null
    store.clearSelection()
  } else {
    selectedSeriesId.value = seriesId
    
    if (store.selectedTimeRange) {
      store.setSelection(store.selectedTimeRange, [seriesId])
    }
  }
}

const handleSeriesHover = (seriesId, isHovering) => {
  hoveredSeriesId.value = isHovering ? seriesId : null
}

const formatTime = (time) => {
  const hours = Math.floor(time)
  const minutes = Math.floor((time - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

const confirmSelection = () => {
  selectionPending.value = false
  
  if (store.selectedTimeRange) {
    const { start, end } = store.selectedTimeRange
    if (Math.abs(end - start) < 0.1) {
      store.setSelection({
        start,
        end: start + 0.1
      }, store.selectedSeries)
    }
  }
  
  ElMessage.success('Selection confirmed')
}

const cancelSelection = () => {
  store.clearSelection()
  selectionPending.value = false
  showSelectionButtons.value = false
  dragStartTime.value = null
  dragStartValue.value = null
  ElMessage.info('Selection cancelled')
}

const applySelection = () => {
  selectionPending.value = false
  showSelectionButtons.value = false
}

const mouseReleasePosition = ref(null)
const showSelectionButtons = ref(false)

// 组织序列以支持父子关系显示
const organizedSeries = computed(() => {
  // 找出所有没有 parentId 的顶级序列
  return store.series.filter(s => !s.parentId);
});

// 获取特定父序列的所有子序列
const getChildSeries = (parentId) => {
  // 获取所有子序列
  const children = store.series.filter(s => s.parentId === parentId);
  
  // 定义序列类型的排序顺序
  const typeOrder = {
    'hf': 1,  // HF 排在最前面
    'mf': 2,  // MF 排在中间
    'lf': 3   // LF 排在最后
  };
  
  // 根据类型排序
  return children.sort((a, b) => {
    // 默认值，如果没有type属性或不是预期的类型
    const aOrder = a.type && typeOrder[a.type.toLowerCase()] ? typeOrder[a.type.toLowerCase()] : 99;
    const bOrder = b.type && typeOrder[b.type.toLowerCase()] ? typeOrder[b.type.toLowerCase()] : 99;
    return aOrder - bOrder;
  });
};

// Function to initialize default data with the new range
const initializeDefaultData = () => {
  // 使用三种不同类型的参数生成数据
  const defaultSeries = [
    { id: 'Default 1', patternType: 'morning' },
    { id: 'Default 2', patternType: 'afternoon' },
    { id: 'Default 3', patternType: 'evening' }
  ];
  
  defaultSeries.forEach(({ id, patternType }) => {
    // 直接使用 generateData.js 中的函数
    const data = generateHouseData(1, patternType); // 只生成1天的数据，传入模式类型
    
    // 添加到 store
    store.addSeries({
      id,
      label: id,
      data: data,
      type: 'original',
      visible: true,
      color: getRandomColor()
    });
  });
  
  // 设置视图范围
  if (typeof store.setViewport === 'function') {
    store.setViewport({
      start: 0,
      end: 24
    });
  }
};

onMounted(() => {
  try {
    // Try our custom initialization
    initializeDefaultData();
  } catch (error) {
    console.warn('Error in custom initialization:', error);
    // Fall back to a simpler method or the store's built-in method
    initializeDefaultData();
  }
  
  // 合并重复的事件监听
  window.addEventListener('add-time-series', (event) => {
    console.log('TimeSeriesEditor 接收到的数据:', event.detail);
    handleAddTimeSeries(event);
  });
})

onUnmounted(() => {
  // 移除事件监听 (也只需要一处)
  window.removeEventListener('add-time-series', handleAddTimeSeries);
})

// Modify the handleAddTimeSeries function to ensure the series appears in the view
const handleAddTimeSeries = (event) => {
  const seriesDataArray = event.detail;
  
  if (!seriesDataArray || !seriesDataArray.length) {
    ElMessage.warning('No valid time series data to add');
    return;
  }
  
  let addedSeriesIds = []; // Track added series for selection
  
  // Process each series in the array
  seriesDataArray.forEach(seriesData => {
    const { id, date, data } = seriesData;
    
    // Create a unique series ID to avoid conflicts
    const seriesId = `user_${id}_${date}`;
    
    // Transform data format if needed for store
    const transformedData = data.map(point => ({
      time: convertTimeStringToHours(point.time),
      value: point.value
    })).sort((a, b) => a.time - b.time); // Ensure time-sorted data
    
    // Add the series to the store
    store.addSeries({
      id: seriesId,
      label: `User ${id} (${date})`,
      data: transformedData,
      visible: true,
      color: getRandomColor(),
      type: 'original' // Important: set the type for proper rendering
    });
    
    addedSeriesIds.push(seriesId);
  });
  
  // Select all newly added series
  if (addedSeriesIds.length > 0) {
    selectedSeriesId.value = addedSeriesIds[0];
    
    // Check if setSelectedSeries exists before calling it
    if (typeof store.setSelectedSeries === 'function') {
      store.setSelectedSeries(addedSeriesIds);
    }
    
    // Find the time range of the first added series to focus the chart
    const firstSeries = store.series.find(s => s.id === addedSeriesIds[0]);
    if (firstSeries && firstSeries.data.length > 0) {
      const times = firstSeries.data.map(p => p.time);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      // Set the viewport to show the full time series if the function exists
      if (typeof store.setViewport === 'function') {
        store.setViewport({
          start: Math.max(0, minTime - 0.5), // Add some padding
          end: Math.min(24, maxTime + 0.5)   // Add some padding, but cap at 24 hours
        });
      }
    }
  }
  
  ElMessage.success(`Added ${seriesDataArray.length} new time series`);
  
  // Force reactivity update if needed
  nextTick(() => {
    // This ensures Vue's reactivity system picks up the changes
    store.triggerUpdate();
  });
};

// Helper function to convert time strings (HH:MM:SS) to hours (decimal format)
const convertTimeStringToHours = (timeStr) => {
  const [hours, minutes, seconds = '0'] = timeStr.split(':').map(Number);
  return hours + (minutes / 60) + (seconds / 3600);
};

// Helper function to generate random colors
const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Debug helper - expose to window for console debugging
if (typeof window !== 'undefined') {
  window.__timeSeriesDebug = {
    store,
    getSeriesCount: () => store.series.length,
    getSeriesIds: () => store.series.map(s => s.id),
    organizedSeries: computed(() => organizedSeries.value),
    exportCurrentState: () => JSON.stringify(store.series)
  };
}

// 添加防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 将图表更新操作包装在防抖函数中
const debouncedUpdateChart = debounce(() => {
  // 图表更新逻辑
  store.triggerUpdate();
}, 100);

// 在数据变化监听中使用防抖函数
watch(() => store.series, () => {
  debouncedUpdateChart();
}, { deep: true });

// Add a new ref to store initial series state
const initialSeriesState = ref(null);
</script>

<template>
  <div class="h-screen flex flex-col bg-white no-drag">
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top section with editor -->
      <div class="h-[47.1%] flex overflow-hidden"
           :style="{
             borderBottomWidth: `${BORDER_WIDTH}px`,
             borderColor: BORDER_COLOR
           }">
        <!-- Toolbar -->
        <div class="w-[65px] flex-none flex flex-col items-center">
          <div class="toolbar flex flex-col items-center gap-4 mt-4 ml-2">
            <!-- 循环生成按钮和分隔线 -->
            <template v-for="(tool, index) in tools" :key="tool.id">
              <button
                @click="selectTool(tool.id)"
                class="w-[48px] h-[48px] flex items-center justify-center rounded-lg transition-all duration-200 shadow-sm"
                :class="{
                  'bg-purple-100 text-purple-700 shadow-md scale-105': tool.active,
                  'text-gray-500 hover:bg-gray-50 hover:scale-105 hover:shadow': !tool.active,
                  'opacity-50 cursor-not-allowed': selectionPending
                }"
                :title="tool.name"
                :disabled="selectionPending"
              >
                <img :src="`/src/assets/${tool.icon}`" :alt="tool.name" class="w-[36px] h-[36px]" draggable="false" />
              </button>
              
              <!-- 只在第1个和第3个按钮后添加分隔线 -->
              <div v-if="index === 1 || index === 3" 
                   class="w-[24px] h-[1px] bg-[#8B5FFF] my-2">
              </div>
            </template>
          </div>
        </div>

        <!-- Main content area -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Main content -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 px-6 pt-2 pb-4">
              <TimeSeriesChart
                :series="[...store.series, ...(store.previewSeries ? [store.previewSeries] : [])]"
                :height="null"
                :showGrid="true"
                :selection="store.selectedTimeRange"
                :multiSelect="isMultiSelect"
                :activeTool="activeTool"
                :isMainChart="true"
                :hoveredSeriesId="hoveredSeriesId"
                :selectedSeriesId="selectedSeriesId"
                :selectedSeries="store.selectedSeries"
                :timeAxisConfig="timeAxisConfig"
                :cloneHighlightArea="cloneHighlightArea"
                @click="handleChartClick"
                @drag="handleChartDrag"
                @dragStart="handleDragStart"
                @dragEnd="handleDragEnd"
                @selectionComplete="handleSelectionComplete"
                @seriesClick="handleSeriesClick"
                @hover="handleChartHover"
              />
            </div>
            
            <!-- 选择确认/取消按钮 -->
            <div 
              v-if="showSelectionButtons && mouseReleasePosition" 
              class="absolute flex flex-col gap-2"
              :style="{
                left: `${mouseReleasePosition.x + 10}px`,
                top: `${mouseReleasePosition.y - 40}px` 
              }"
            >
              <button 
                @click="applySelection" 
                class="p-1 rounded-full border border-gray-200 bg-white flex items-center justify-center w-7 h-7 hover:border-green-300" 
                title="Apply"
              >
                <img src="/src/assets/apply.svg" alt="Apply" class="w-5 h-5" />
              </button>
              <button 
                @click="cancelSelection" 
                class="p-1 rounded-full border border-gray-200 bg-white flex items-center justify-center w-7 h-7 hover:border-red-300" 
                title="Cancel"
              >
                <img src="/src/assets/cancel.svg" alt="Cancel" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Side panel -->
          <div v-if="showSidePanel" class="w-[30%] border-l border-gray-200 flex flex-col h-full overflow-hidden">
            <template v-if="activeTool === 'curve'">
              <div class="h-full flex flex-col p-6">
                <h3 class="text-lg font-medium mb-4">Curve Editor</h3>
                
                <div class="mb-4">
                  <p class="text-sm text-gray-600 mb-2">Presets:</p>
                  <div class="flex flex-wrap gap-2">
                    <button 
                      v-for="preset in ['ease-in', 'ease-out', 'ease-in-out', 's-curve', 'step']"
                      :key="preset"
                      @click="$refs.curveEditor.applyPreset(preset)"
                      class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                    >
                      {{ preset.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') }}
                    </button>
                  </div>
                </div>
                
                <div class="flex-1 overflow-hidden">
                  <CurveEditor
                    ref="curveEditor"
                    :visible="true"
                    :timeRange="store.selectedTimeRange"
                    :seriesId="selectedSeriesId"
                    @change="handleCurveChange"
                  />
                </div>
                
                <div class="mt-4 pt-4 border-t flex justify-end gap-2">
                  <button
                    @click="$refs.curveEditor.resetToDefault()"
                    class="p-2 transition-all duration-150 hover:scale-110"
                    title="Reset"
                  >
                    <img src="/src/assets/cancel.svg" alt="Reset" class="w-6 h-6" />
                  </button>
                  <button
                    @click="handleCurveApply"
                    class="p-2 transition-all duration-150 hover:scale-110"
                    :disabled="!previewCurve"
                    title="Apply"
                  >
                    <img src="/src/assets/apply.svg" alt="Apply" class="w-6 h-6" />
                  </button>
                </div>
              </div>
            </template>

            <template v-if="activeTool === 'removal'">
              <div class="h-full flex flex-col overflow-hidden">
                <div class="flex-none p-6 border-b border-gray-200">
                  <h3 class="text-lg font-medium">Similar Patterns</h3>
                  <p class="text-sm text-gray-600 mt-1">
                    Showing similar patterns from series {{ selectedSeriesId }}
                  </p>
                </div>
                
                <div class="flex-1 overflow-y-auto p-6">
                  <div v-if="generatePatterns.length === 0" class="text-center py-8 text-gray-500">
                    No similar patterns found
                  </div>
                  
                  <div v-else class="space-y-4">
                    <div 
                      v-for="pattern in generatePatterns" 
                      :key="`${pattern.start}-${pattern.end}`"
                      class="border rounded-lg p-4 cursor-pointer transition-all duration-200"
                      :class="{
                        'border-purple-500 bg-purple-50': selectedPattern === pattern,
                        'border-gray-200 hover:border-purple-300': selectedPattern !== pattern
                      }"
                      @click="handleGenerateSelect(pattern)"
                    >
                      <div class="flex justify-between items-center mb-2">
                        <div class="text-sm text-gray-600">
                          <span class="mr-2">Source: {{ pattern.sourceName }}</span>
                        </div>
                        <div class="text-sm text-purple-600 font-semibold">
                          Similarity: {{ (pattern.similarity * 100).toFixed(1) }}%
                        </div>
                      </div>
                      <div class="text-sm text-gray-600 mb-2">
                        Time range: {{ formatTime(pattern.start) }} - {{ formatTime(pattern.end) }}
                      </div>
                      <div class="h-[90px]">
                        <PatternChart
                          :pattern="pattern"
                          :height="90"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="flex-none p-6 border-t border-gray-200">
                  <div class="flex justify-end gap-2">
                    <button
                      @click="handleGenerateReset"
                      class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Reset
                    </button>
                    <button
                      @click="handleGenerateApply"
                      class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                      :disabled="!selectedPattern"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Bottom section with series list -->
      <div class="h-[52.9%] flex flex-col">
        <!-- Fixed time axis -->
        <div class="flex-none pt-[4px]"
             :style="{
               borderBottomWidth: `${BORDER_WIDTH}px`,
               borderColor: BORDER_COLOR
             }">
          <div class="flex items-center">
            <!-- View label -->
            <div class="w-[65px] flex justify-center">
              <span class="text-large to-black">View</span>
            </div>
            <!-- Time axis -->
            <div class="flex-1 px-6">
              <TimeSeriesChart
                :series="[]"
                :height="20"
                :showGrid="false"
                :isMainChart="false"
                :timeAxisConfig="timeAxisConfig"
                class="time-axis-only"
              />
            </div>
          </div>
        </div>

        <!-- Scrollable series list -->
        <el-scrollbar class="flex-1 pt-0 pb-4">
          <!-- 使用计算属性对序列进行分组，将子序列显示在原序列下方 -->
          <template v-for="parentSeries in organizedSeries" :key="parentSeries.id">
            <!-- 父序列 -->
            <TimeSeriesView
              :series="parentSeries"
              :isSelected="selectedSeriesId === parentSeries.id"
              :hoverTime="hoverTime"
              :timeAxisConfig="timeAxisConfig"
              @click="handleSeriesClick(parentSeries.id)"
              @hover="(isHovering) => handleSeriesHover(parentSeries.id, isHovering)"
            />
            
            <!-- 子序列 -->
            <TimeSeriesView
              v-for="childSeries in getChildSeries(parentSeries.id)"
              :key="childSeries.id"
              :series="childSeries"
              :isSelected="selectedSeriesId === childSeries.id"
              :hoverTime="hoverTime"
              :timeAxisConfig="timeAxisConfig"
              @click="handleSeriesClick(childSeries.id)"
              @hover="(isHovering) => handleSeriesHover(childSeries.id, isHovering)"
            />
          </template>
          <div class="h-20"></div>
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped>
[style*="border"] {
  border-style: solid;
}

/* 添加禁用拖拽的样式 */
.no-drag {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

.no-drag * {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

.toolbar {
  /* 调整工具栏布局 */
  padding-top: 8px;  /* 减少顶部间距 */
  justify-content: flex-start;
}

.toolbar button {
  transform-origin: center;
}

.toolbar button:hover {
  transform: scale(1.05);
}

.toolbar button:active {
  transform: scale(0.95);
}

.time-axis-only {
  height: 20px;
  overflow: visible;
  margin-bottom: 0;
  margin-right: 20px;
}

/* 调整滚动区域样式 */
:deep(.el-scrollbar__wrap) {
  overflow-x: hidden !important;
}

:deep(.el-scrollbar__view) {
  padding-bottom: 20px;
}

/* 添加到现有样式中 */
.pattern-list-item {
  border-radius: 8px;
  transition: all 0.2s ease;
}

.pattern-list-item:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.pattern-list-item.selected {
  border-color: #8367F8;
  background-color: rgba(131, 103, 248, 0.05);
}

.similarity-badge {
  font-weight: 600;
  color: #8367F8;
}

.time-range {
  color: #6B7280;
  font-size: 0.875rem;
}

.source-name {
  font-weight: 500;
}
</style>