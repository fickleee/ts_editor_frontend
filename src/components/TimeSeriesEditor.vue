<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTimeSeriesStore } from '../stores/timeSeriesStore'
import TimeSeriesChart from './TimeSeriesChart.vue'
import TimeSeriesView from './TimeSeriesView.vue'
import CurveEditor from './CurveEditor.vue'
import { ElMessage } from 'element-plus'
import { BORDER_WIDTH, BORDER_COLOR } from '../utils/constants'

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
      return
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
          store.moveSeries(selectedSeriesId.value, { x: offset * 0.0005, y: 0 })
          store.setSelection({
            start: store.selectedTimeRange.start + offset * 0.0005,
            end: store.selectedTimeRange.end + offset * 0.0005
          }, [selectedSeriesId.value])
        } else {
          store.selectedSeries.forEach(id => {
            store.moveSeries(id, { x: offset * 0.0005, y: 0 })
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
          store.moveSeries(selectedSeriesId.value, { x: 0, y: offset * 0.001 })
        } else {
          store.selectedSeries.forEach(id => {
            store.moveSeries(id, { x: 0, y: offset * 0.001 })
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
  previewCurve.value = curve
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

const handleDragEnd = () => {
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
  selectionPending.value = false
  store.clearSelection()
  dragStartTime.value = null
  dragStartValue.value = null
  ElMessage.info('Selection cancelled')
}

onMounted(() => {
  store.initializeData()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-white">
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top section with editor -->
      <div class="h-[47.1%] flex overflow-hidden"
           :style="{
             borderBottomWidth: `${BORDER_WIDTH}px`,
             borderColor: BORDER_COLOR
           }">
        <!-- Toolbar -->
        <div class="w-[65px] flex-none flex flex-col items-center">
          <div class="toolbar flex flex-col items-center gap-4 mt-4">
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
                <img :src="`/src/assets/${tool.icon}`" :alt="tool.name" class="w-[36px] h-[36px]" />
              </button>
              
              <!-- 只在第1个和第3个按钮后添加分隔线 -->
              <div v-if="index === 1 || index === 3" 
                   class="w-[24px] h-[1px] bg-gray-200 my-2">
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
            <div v-if="selectionPending && store.selectedTimeRange" 
                class="absolute flex flex-col gap-2"
                :style="{
                  right: '5px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }">
              <button
                @click="confirmSelection"
                class="p-2 transition-all duration-150 hover:scale-110"
                title="Confirm Selection"
              >
                <img src="/src/assets/apply.svg" alt="Apply" class="w-8 h-8" />
              </button>
              <button
                @click="cancelSelection"
                class="p-2 transition-all duration-150 hover:scale-110"
                title="Cancel Selection"
              >
                <img src="/src/assets/cancel.svg" alt="Cancel" class="w-8 h-8" />
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
                          <span v-if="pattern.sourceType !== 'original'" 
                                :class="`px-1 py-0.5 text-xs rounded ${
                                  pattern.sourceType === 'LF' ? 'bg-yellow-100 text-yellow-800' : 
                                  pattern.sourceType === 'MF' ? 'bg-pink-100 text-pink-800' : 
                                  'bg-indigo-100 text-indigo-800'
                                }`"
                          >
                            {{ pattern.sourceType }}
                          </span>
                        </div>
                        <div class="text-sm text-purple-600">
                          Similarity: {{ (pattern.similarity * 100).toFixed(1) }}%
                        </div>
                      </div>
                      <div class="text-sm text-gray-600 mb-2">
                        Time range: {{ formatTime(pattern.start) }} - {{ formatTime(pattern.end) }}
                      </div>
                      <div class="h-[90px]">
                        <TimeSeriesChart
                          :series="[{ id: 'preview', data: pattern.data, type: 'original', visible: true, color: pattern.color }]"
                          :height="90"
                          :showGrid="true"
                          :showTimeAxis="false"
                          :isMainChart="false"
                          :isGeneratePreview="true"
                          :showAxisLabels="true"
                          :gridDensity="'normal'"
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
          <TimeSeriesView
            v-for="s in store.series"
            :key="s.id"
            :series="s"
            :isSelected="selectedSeriesId === s.id"
            :hoverTime="hoverTime"
            :timeAxisConfig="timeAxisConfig"
            @click="handleSeriesClick(s.id)"
            @hover="(isHovering) => handleSeriesHover(s.id, isHovering)"
          />
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
</style>