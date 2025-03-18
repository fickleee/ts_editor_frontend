<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTimeSeriesStore } from '../stores/timeSeriesStore'
import TimeSeriesChart from './TimeSeriesChart.vue'
import TimeSeriesView from './TimeSeriesView.vue'
import CurveEditor from './CurveEditor.vue'
import { ElMessage } from 'element-plus'

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
    id: 'generate', 
    name: 'Generate',
    icon: 'generate.svg',
    active: false 
  }
])

const activeTool = ref(null)
const isDragging = ref(false)
const dragStartTime = ref(null)
const dragStartValue = ref(null)
const isMultiSelect = ref(false)
const selections = ref([])
const dragStartPoint = ref(null)
const generatePatterns = ref([])
const selectedPattern = ref(null)
const selectedSeriesId = ref(null)
const hoveredSeriesId = ref(null)
const hoverTime = ref(null)

const previewCurve = ref(null)

const timeAxisConfig = ref({
  marginLeft: 100,
  marginRight: 20,
  width: null
})

const showSidePanel = computed(() => {
  return activeTool.value === 'curve' || activeTool.value === 'generate'
})

const handleChartHover = (time) => {
  hoverTime.value = time
}

const selectTool = (toolId) => {
  if (toolId === activeTool.value) {
    if (toolId === 'expand' && selections.value.length > 0) {
      store.expandTimeSeries(selections.value)
    } else if (toolId === 'generate' && store.selectedTimeRange && selectedSeriesId.value) {
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

  if (toolId === 'generate' && store.selectedTimeRange && selectedSeriesId.value) {
    generatePatterns.value = store.findSimilarPatterns(selectedSeriesId.value)
  }
}

const handleChartClick = (time, value) => {
  if (!activeTool.value) {
    if (!dragStartTime.value) {
      dragStartTime.value = time
      dragStartValue.value = value
    } else {
      const timeRange = {
        start: Math.min(dragStartTime.value, time),
        end: Math.max(dragStartTime.value, time)
      }
      
      if (selectedSeriesId.value) {
        store.setSelection(timeRange, [selectedSeriesId.value])
      } else {
        store.setSelection(timeRange, store.series.map(s => s.id))
      }
      
      dragStartTime.value = null
      dragStartValue.value = null
    }
    return
  }

  switch (activeTool.value) {
    case 'clone':
      if (store.selectedTimeRange) {
        if (selectedSeriesId.value) {
          store.cloneSeries(selectedSeriesId.value, time)
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

  switch (activeTool.value) {
    case 'move-x':
      if (store.selectedTimeRange) {
        const offset = dragPoint.x - (dragStartPoint.value?.x || 0)
        
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
        if (selectedSeriesId.value) {
          store.setSelection(timeRange, [selectedSeriesId.value])
        } else {
          store.setSelection(timeRange, store.series.map(s => s.id))
        }
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
}

const handleDragEnd = () => {
  isDragging.value = false
  dragStartPoint.value = null
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

onMounted(() => {
  store.initializeData()
})
</script>

<template>
  <div class="h-full flex">
    <!-- Main content area -->
    <div class="flex-1 flex flex-col bg-white overflow-hidden">
      <!-- Top section with chart -->
      <div class="h-1/2 border-b border-gray-200 relative">
        <!-- Tools sidebar -->
        <div class="absolute left-0 top-0 bottom-0 w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 toolbar">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200"
          :class="{
            // 基础颜色配置
            'bg-[#FC8E8E]': ['move-x', 'expand'].includes(tool.id),
            'bg-[#75B2EC]': ['move-y', 'curve'].includes(tool.id),
            'bg-[#FDC086]': ['clone', 'generate'].includes(tool.id),
            
            // 悬停效果
            'hover:bg-[#FC8E8E]/90': ['move-x', 'expand'].includes(tool.id) && !tool.active,
            'hover:bg-[#75B2EC]/90': ['move-y', 'curve'].includes(tool.id) && !tool.active,
            'hover:bg-[#FDC086]/90': ['clone', 'generate'].includes(tool.id) && !tool.active,
            
            // 激活状态
            'shadow-md ring-1 ring-gray-200': tool.active,
            
            // 禁用状态
            'opacity-50 cursor-not-allowed': (!store.selectedTimeRange && tool.id !== 'expand') || 
              (tool.id === 'generate' && !selectedSeriesId)
          }"
          :disabled="(!store.selectedTimeRange && tool.id !== 'expand') || 
            (tool.id === 'generate' && !selectedSeriesId)"
          @click="selectTool(tool.id)"
          :title="tool.name"
        >
          <img :src="`/src/assets/${tool.icon}`" :alt="tool.name" class="w-6 h-6" />
        </button>
      </div>

        <!-- Chart area -->
        <div class="ml-16 flex h-full">
          <div :class="{ 'w-[70%]': showSidePanel, 'w-full': !showSidePanel }" class="flex flex-col h-full">
            <!-- Status info moved back to top -->
            <div class="px-6 py-2 text-sm text-gray-600">
              <template v-if="activeTool === 'expand'">
                <template v-if="selections.length > 0">
                  {{ selections.length }} ranges selected. Click Expand button again to process.
                </template>
                <template v-else>
                  Select time ranges to expand. Click and drag to select ranges.
                </template>
              </template>
              <template v-else-if="selectedSeriesId">
                <span class="font-medium text-purple-600">Series {{ selectedSeriesId }} selected.</span>
                {{ activeTool ? `Selected tool: ${activeTool}` : 'Click and drag to select a time range' }}
                <template v-if="store.selectedTimeRange">
                  ({{ formatTime(store.selectedTimeRange.start) }} - {{ formatTime(store.selectedTimeRange.end) }})
                </template>
              </template>
              <template v-else>
                {{ activeTool ? `Selected tool: ${activeTool}` : 'Click and drag to select a time range' }}
                <template v-if="store.selectedTimeRange">
                  ({{ formatTime(store.selectedTimeRange.start) }} - {{ formatTime(store.selectedTimeRange.end) }})
                </template>
              </template>
            </div>
            
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
                :timeAxisConfig="timeAxisConfig"
                @click="handleChartClick"
                @drag="handleChartDrag"
                @dragStart="handleDragStart"
                @dragEnd="handleDragEnd"
                @selectionComplete="handleSelectionComplete"
                @seriesClick="handleSeriesClick"
                @hover="handleChartHover"
              />
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
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Reset
                  </button>
                  <button
                    @click="handleCurveApply"
                    class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    :disabled="!previewCurve"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </template>

            <template v-if="activeTool === 'generate'">
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
                          Time range: {{ formatTime(pattern.start) }} - {{ formatTime(pattern.end) }}
                        </div>
                        <div class="text-sm text-purple-600">
                          Similarity: {{ (pattern.similarity * 100).toFixed(1) }}%
                        </div>
                      </div>
                      <div class="h-[120px]">
                        <TimeSeriesChart
                          :series="[{ id: 'preview', data: pattern.data, type: 'original', visible: true }]"
                          :height="120"
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
      <div class="h-1/2 flex flex-col">
        <!-- Fixed time axis -->
        <div class="flex-none px-6 pt-1 ml-[65px]">
          <TimeSeriesChart
            :series="[]"
            :height="20"
            :showGrid="false"
            :isMainChart="false"
            :timeAxisConfig="timeAxisConfig"
            class="time-axis-only"
          />
        </div>

        <!-- Scrollable series list -->
        <div class="flex-1 overflow-y-auto">
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar button :deep(svg) {
  width: 25px;
  height: 25px;
}

.toolbar button :deep(svg path) {
  fill: currentColor;
  stroke: none;
}

.toolbar button :deep(svg path[stroke]) {
  fill: none;
  stroke: currentColor;
}

.time-axis-only {
  height: 20px;
  overflow: visible;
  margin-bottom: 0;
  margin-right: 20px;
}
</style>