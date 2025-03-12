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
    icon: `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24.7706 12.0306L20.1873 8.45919C19.9993 8.3128 19.7424 8.29254 19.5337 8.40757C19.3252 8.52261 19.2054 8.75098 19.2291 8.98795L19.4017 10.7145H16.369V9.22637C16.369 8.89766 16.1025 8.63116 15.7738 8.63116H9.22617C8.89746 8.63116 8.63096 8.89766 8.63096 9.22637V10.7145H5.59824L5.77085 8.98795C5.79453 8.75098 5.67471 8.52266 5.46621 8.40757C5.25772 8.29254 5.00068 8.3128 4.8127 8.45919L0.229346 12.0306C0.0846191 12.1434 0 12.3166 0 12.5002C0 12.6837 0.0846191 12.8569 0.229395 12.9697L4.81274 16.5411C4.91958 16.6243 5.04873 16.6669 5.17861 16.6669C5.2772 16.6669 5.37617 16.6424 5.46616 16.5927C5.67466 16.4777 5.79458 16.2494 5.7708 16.0124L5.59819 14.2858H8.63091V15.7739C8.63091 16.1026 8.89746 16.3691 9.22612 16.3691H15.7737C16.1024 16.3691 16.3689 16.1026 16.3689 15.7739V14.2858H19.4017L19.2291 16.0124C19.2054 16.2493 19.3252 16.4776 19.5337 16.5927C19.6237 16.6424 19.7227 16.6669 19.8212 16.6669C19.9512 16.6669 20.0803 16.6244 20.1871 16.5411L24.7705 12.9697C24.9152 12.8569 24.9999 12.6837 24.9999 12.5002C25 12.3166 24.9154 12.1434 24.7706 12.0306ZM8.63096 13.0954H4.94048C4.77231 13.0954 4.61196 13.1665 4.49917 13.2912C4.38633 13.4159 4.33149 13.5825 4.34824 13.7499L4.448 14.7477L1.56367 12.5002L4.44795 10.2526L4.34819 11.2504C4.33145 11.4178 4.38628 11.5844 4.49912 11.7091C4.61191 11.8337 4.77227 11.9049 4.94043 11.9049H8.63091L8.63096 13.0954ZM15.1786 15.1787H9.82144V9.82159H15.1786V15.1787ZM20.552 14.7477L20.6518 13.7498C20.6685 13.5824 20.6137 13.4159 20.5008 13.2912C20.388 13.1665 20.2277 13.0953 20.0595 13.0953H16.369V11.9048H20.0595C20.2277 11.9048 20.388 11.8337 20.5008 11.709C20.6137 11.5843 20.6685 11.4177 20.6518 11.2503L20.552 10.2525L23.4363 12.5002L20.552 14.7477Z" fill="currentColor"/>
          </svg>`, 
    active: false 
  },
  { id: 'move-y', name: 'Move Y', icon: '↕️', active: false },
  { 
    id: 'curve', 
    name: 'Curve', 
    icon: `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clip-path="url(#clip0_748_35)">
            <path d="M7 21.5C7 23.433 5.433 25 3.5 25C1.567 25 0 23.433 0 21.5C0 19.567 1.567 18 3.5 18C5.433 18 7 19.567 7 21.5ZM1.28341 21.5C1.28341 22.7242 2.27581 23.7166 3.5 23.7166C4.72419 23.7166 5.71659 22.7242 5.71659 21.5C5.71659 20.2758 4.72419 19.2834 3.5 19.2834C2.27581 19.2834 1.28341 20.2758 1.28341 21.5Z" fill="currentColor"/>
            <path d="M25 3.5C25 5.433 23.433 7 21.5 7C19.567 7 18 5.433 18 3.5C18 1.567 19.567 0 21.5 0C23.433 0 25 1.567 25 3.5ZM19.2834 3.5C19.2834 4.72419 20.2758 5.71659 21.5 5.71659C22.7242 5.71659 23.7166 4.72419 23.7166 3.5C23.7166 2.27581 22.7242 1.28341 21.5 1.28341C20.2758 1.28341 19.2834 2.27581 19.2834 3.5Z" fill="currentColor"/>
            <path d="M5 19C5 7 20 18.5 20 6" stroke="currentColor" stroke-width="1.5"/>
            </g>
            <defs>
            <clipPath id="clip0_748_35">
            <rect width="25" height="25" fill="white"/>
            </clipPath>
            </defs>
          </svg>`, 
    active: false 
  },
  { id: 'expand', name: 'Expand', icon: '⇔', active: false },
  { 
    id: 'clone', 
    name: 'Clone', 
    icon: `<svg width="25" height="25" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M26.875 27.6564H8.125C7.69531 27.6564 7.34375 27.3048 7.34375 26.8751C7.34375 26.4455 7.69531 26.0939 8.125 26.0939H26.875C27.3047 26.0939 27.6562 26.4455 27.6562 26.8751C27.6562 27.3048 27.3047 27.6564 26.875 27.6564ZM26.875 24.5314H8.125C7.69531 24.5314 7.34375 24.1798 7.34375 23.7501V19.8439C7.34375 18.5548 8.39844 17.5001 9.6875 17.5001H14.6875C14.5312 16.5626 14.0625 15.6642 13.3984 14.883C12.5 13.8673 12.0312 12.5783 12.0312 11.2501C12.0312 9.76576 12.6172 8.35951 13.7109 7.30483C14.8047 6.25014 16.2109 5.74233 17.7344 5.78139C20.5469 5.89858 22.9297 8.32045 22.9688 11.133C23.0078 12.5392 22.4609 13.9064 21.5234 14.9611C20.8594 15.6642 20.4688 16.5236 20.3125 17.5001H25.3125C26.6016 17.5001 27.6562 18.5548 27.6562 19.8439V23.7501C27.6562 24.1798 27.3047 24.5314 26.875 24.5314Z" fill="currentColor"/>
          </svg>`, 
    active: false 
  },
  { id: 'generate', name: 'Generate', icon: '✨', active: false }
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
  return time.toFixed(2)
}

onMounted(() => {
  store.initializeData()
})
</script>

<template>
  <div class="flex h-full bg-gray-50">
    <div class="flex-1 flex flex-col bg-white">
      <div class="flex-1 border-b border-gray-200 relative">
        <div class="absolute left-0 top-0 bottom-0 w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 toolbar">
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="w-12 h-12 rounded-lg flex items-center justify-center text-xl transition-all duration-200"
            :class="{
              'bg-purple-100 text-purple-600': tool.active,
              'bg-white text-gray-600 hover:bg-gray-50': !tool.active,
              'opacity-50 cursor-not-allowed': !store.selectedTimeRange && tool.id !== 'expand' || 
                                             (tool.id === 'generate' && !selectedSeriesId)
            }"
            :disabled="!store.selectedTimeRange && tool.id !== 'expand' || 
                      (tool.id === 'generate' && !selectedSeriesId)"
            @click="selectTool(tool.id)"
            :title="tool.name"
          >
            <span v-if="['move-x', 'clone', 'curve'].includes(tool.id)" v-html="tool.icon"></span>
            <span v-else>{{ tool.icon }}</span>
          </button>
        </div>

        <div class="ml-16 flex h-full">
          <div :class="{ 'w-[70%]': showSidePanel, 'w-full': !showSidePanel }" class="flex flex-col h-full">
            <div class="px-6 py-4">
              <div class="text-sm text-gray-600">
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
                  {{ store.selectedTimeRange ? `(${store.selectedTimeRange.start.toFixed(2)} - ${store.selectedTimeRange.end.toFixed(2)})` : '' }}
                </template>
                <template v-else>
                  {{ activeTool ? `Selected tool: ${activeTool}` : 'Click and drag to select a time range' }}
                  {{ store.selectedTimeRange ? `(${store.selectedTimeRange.start.toFixed(2)} - ${store.selectedTimeRange.end.toFixed(2)})` : '' }}
                </template>
              </div>
            </div>
            
            <div class="flex-1 px-6 pb-6">
              <TimeSeriesChart
                :series="[...store.series, ...(store.previewSeries ? [store.previewSeries] : [])]"
                :height="null"
                :showGrid="true"
                :selection="store.selectedTimeRange"
                :multiSelect="isMultiSelect"
                :activeTool="activeTool"
                :isMainChart="true"
                :hoveredSeriesId="hoveredSeriesId"
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

          <div v-if="showSidePanel" class="w-[30%] border-l border-gray-200 flex flex-col h-full">
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
              <div class="h-full flex flex-col">
                <div class="flex-none p-6 border-b border-gray-200">
                  <h3 class="text-lg font-medium">Similar Patterns</h3>
                  <p class="text-sm text-gray-600 mt-1">
                    Showing similar patterns from series {{ selectedSeriesId }}
                  </p>
                </div>
                
                <div class="flex-1 overflow-y-auto">
                  <div class="p-6">
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
                            :showGrid="false"
                            :isMainChart="false"
                            :isGeneratePreview="true"
                          />
                        </div>
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

      <div class="h-1/2 overflow-y-auto bg-white">
        <div class="ml-16">
          <TimeSeriesView
            v-for="s in store.series"
            :key="s.id"
            :series="s"
            :isSelected="selectedSeriesId === s.id"
            :hoverTime="hoverTime"
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
</style>