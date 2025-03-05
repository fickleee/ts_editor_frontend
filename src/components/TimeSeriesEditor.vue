<script setup>
import { ref, onMounted } from 'vue'
import { useTimeSeriesStore } from '../stores/timeSeriesStore'
import TimeSeriesChart from './TimeSeriesChart.vue'
import TimeSeriesView from './TimeSeriesView.vue'
import CurveEditor from './CurveEditor.vue'
import GenerateDialog from './GenerateDialog.vue'
import ImportDialog from './ImportDialog.vue'
import { downloadCSV } from '../utils/csvUtils'

const store = useTimeSeriesStore()

const tools = ref([
  { id: 'move-x', name: 'Move X', icon: '↔️', active: false },
  { id: 'move-y', name: 'Move Y', icon: '↕️', active: false },
  { id: 'curve', name: 'Curve', icon: '📊', active: false },
  { id: 'expand', name: 'Expand', icon: '⇔', active: false },
  { 
    id: 'clone', 
    name: 'Clone', 
    icon: `<svg width="25" height="25" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M26.875 27.6564H8.125C7.69531 27.6564 7.34375 27.3048 7.34375 26.8751C7.34375 26.4455 7.69531 26.0939 8.125 26.0939H26.875C27.3047 26.0939 27.6562 26.4455 27.6562 26.8751C27.6562 27.3048 27.3047 27.6564 26.875 27.6564ZM26.875 24.5314H8.125C7.69531 24.5314 7.34375 24.1798 7.34375 23.7501V19.8439C7.34375 18.5548 8.39844 17.5001 9.6875 17.5001H14.6875C14.5312 16.5626 14.0625 15.6642 13.3984 14.883C12.5 13.8673 12.0312 12.5783 12.0312 11.2501C12.0312 9.76576 12.6172 8.35951 13.7109 7.30483C14.8047 6.25014 16.2109 5.74233 17.7344 5.78139C20.5469 5.89858 22.9297 8.32045 22.9688 11.133C23.0078 12.5392 22.4609 13.9064 21.5234 14.9611C20.8594 15.6642 20.4688 16.5236 20.3125 17.5001H25.3125C26.6016 17.5001 27.6562 18.5548 27.6562 19.8439V23.7501C27.6562 24.1798 27.3047 24.5314 26.875 24.5314ZM8.90625 22.9689H26.0938V19.8439C26.0938 19.4142 25.7422 19.0626 25.3125 19.0626H19.4531C19.0234 19.0626 18.6719 18.7111 18.6719 18.2814C18.6719 16.6408 19.2578 15.0783 20.3516 13.9064C21.0547 13.1642 21.4062 12.1876 21.4062 11.172C21.3672 9.14076 19.6875 7.42201 17.6563 7.34389C16.5625 7.30483 15.5469 7.69545 14.8047 8.43764C14.0234 9.17983 13.5938 10.1955 13.5938 11.2501C13.5938 12.1876 13.9453 13.1251 14.5703 13.8283C15.7031 15.1173 16.3281 16.6798 16.3281 18.2814C16.3281 18.7111 15.9766 19.0626 15.5469 19.0626H9.6875C9.25781 19.0626 8.90625 19.4142 8.90625 19.8439V22.9689Z" fill="currentColor"/>
          </svg>`, 
    active: false 
  },
  { id: 'generate', name: 'Generate', icon: '✨', active: false }
])

const activeTool = ref(null)
const isDragging = ref(false)
const showCurveEditor = ref(false)
const showGenerateDialog = ref(false)
const showImportDialog = ref(false)
const dragStartTime = ref(null)
const dragStartValue = ref(null)
const isMultiSelect = ref(false)
const selections = ref([])
const dragStartPoint = ref(null)
const generatePatterns = ref([])
const generateTargetTime = ref(0)
const selectedSeriesId = ref(null)
const hoveredSeriesId = ref(null)

const selectTool = (toolId) => {
  // If clicking the same tool
  if (toolId === activeTool.value) {
    if (toolId === 'expand' && selections.value.length > 0) {
      // Process expand selections
      store.expandTimeSeries(selections.value)
    } else if (toolId === 'generate' && store.selectedTimeRange) {
      // Show generate dialog when clicking the generate button with a selection
      generatePatterns.value = selectedSeriesId.value 
        ? store.findSimilarPatterns(selectedSeriesId.value)
        : store.findSimilarPatterns()
      showGenerateDialog.value = true
      return
    }
    // Clear selection and tool state
    activeTool.value = null
    tools.value.forEach(tool => tool.active = false)
    isMultiSelect.value = false
    selections.value = []
    dragStartTime.value = null
    dragStartValue.value = null
    return
  }

  // Reset state when selecting a new tool
  if (toolId !== activeTool.value) {
    dragStartTime.value = null
    dragStartValue.value = null
    selections.value = []
  }

  tools.value.forEach(tool => tool.active = tool.id === toolId)
  activeTool.value = toolId

  if (toolId === 'curve') {
    showCurveEditor.value = true
  } else if (toolId === 'expand') {
    isMultiSelect.value = true
  } else {
    isMultiSelect.value = false
    selections.value = []
  }
}

const handleChartClick = (time, value) => {
  if (!activeTool.value) {
    // Always in selection mode when no tool is active
    if (!dragStartTime.value) {
      dragStartTime.value = time
      dragStartValue.value = value
    } else {
      const timeRange = {
        start: Math.min(dragStartTime.value, time),
        end: Math.max(dragStartTime.value, time)
      }
      
      // If a series is selected, only apply selection to that series
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
          // Clone only the selected series
          store.cloneSeries(selectedSeriesId.value, time)
        } else {
          // Clone all selected series
          store.selectedSeries.forEach(id => {
            store.cloneSeries(id, time)
          })
        }
        // Don't reset the tool after cloning
      }
      break
  }
}

const handleChartDrag = (timeRange, valueRange, dragPoint) => {
  if (!isDragging.value) return

  switch (activeTool.value) {
    case 'move-x':
      if (store.selectedTimeRange) {
        // Calculate offset based on drag point movement with reduced sensitivity
        const offset = dragPoint.x - (dragStartPoint.value?.x || 0)
        
        if (selectedSeriesId.value) {
          // Move only the selected series
          store.moveSeries(selectedSeriesId.value, { x: offset * 0.0005, y: 0 })
          store.setSelection({
            start: store.selectedTimeRange.start + offset * 0.0005,
            end: store.selectedTimeRange.end + offset * 0.0005
          }, [selectedSeriesId.value])
        } else {
          // Move all selected series
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
        // Calculate offset based on drag point movement with reduced sensitivity
        const offset = (dragStartPoint.value?.y || 0) - dragPoint.y
        
        if (selectedSeriesId.value) {
          // Move only the selected series
          store.moveSeries(selectedSeriesId.value, { x: 0, y: offset * 0.02 })
        } else {
          // Move all selected series
          store.selectedSeries.forEach(id => {
            store.moveSeries(id, { x: 0, y: offset * 0.02 })
          })
        }
      }
      break
    default:
      // Default behavior is selection
      if (!isMultiSelect.value) {
        // If a series is selected, only apply selection to that series
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

const handleCurveChange = (curve, seriesId) => {
  if (!store.selectedTimeRange) return
  
  // Save current selection
  const currentSelection = { ...store.selectedTimeRange }
  
  // Apply curve to selected series or all selected series
  if (seriesId || selectedSeriesId.value) {
    const targetSeriesId = seriesId || selectedSeriesId.value
    if (targetSeriesId) {
      store.applyCurve(targetSeriesId, curve)
      // Restore selection for the single series
      store.setSelection(currentSelection, [targetSeriesId])
    }
  } else {
    store.selectedSeries.forEach(id => {
      store.applyCurve(id, curve)
    })
    // Restore selection for all series
    store.setSelection(currentSelection, store.selectedSeries)
  }
  
  // Close curve editor
  showCurveEditor.value = false
  
  // Keep tool active
  activeTool.value = 'curve'
  tools.value.find(t => t.id === 'curve').active = true
}

const handleGenerateSelect = (pattern) => {
  // Apply the selected pattern to replace the selected range
  if (selectedSeriesId.value) {
    // Replace only in the selected series
    store.replaceWithPattern(pattern, [selectedSeriesId.value])
  } else {
    // Replace in all selected series
    store.replaceWithPattern(pattern)
  }
  
  // Close dialog but maintain selection and tool state
  showGenerateDialog.value = false
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
  // Toggle series selection
  if (selectedSeriesId.value === seriesId) {
    selectedSeriesId.value = null
    // Clear any existing selection
    store.clearSelection()
  } else {
    selectedSeriesId.value = seriesId
    
    // If there's an existing time range selection, apply it to the newly selected series
    if (store.selectedTimeRange) {
      store.setSelection(store.selectedTimeRange, [seriesId])
    }
  }
}

const handleSeriesHover = (seriesId, isHovering) => {
  hoveredSeriesId.value = isHovering ? seriesId : null
}

const handleImportData = () => {
  showImportDialog.value = true
}

const handleImportComplete = (data) => {
  store.importData(data)
  showImportDialog.value = false
}

const exportAllSeries = () => {
  // Create a zip file with all series
  if (store.series.length === 0) return
  
  // Export each series individually
  store.series.forEach(series => {
    if (series.visible) {
      downloadCSV(series.data, `${series.id}_export.csv`)
    }
  })
}

// Initialize with sample data
onMounted(() => {
  store.initializeData()
})
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Tools sidebar -->
    <div class="w-16 bg-white border-r border-gray-200 p-2 flex flex-col gap-4 toolbar">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="w-12 h-12 rounded-lg flex items-center justify-center text-xl transition-all duration-200"
        :class="{
          'bg-purple-100 text-purple-600': tool.active,
          'bg-white text-gray-600 hover:bg-gray-50': !tool.active,
          'opacity-50 cursor-not-allowed': !store.selectedTimeRange && tool.id !== 'expand'
        }"
        :disabled="!store.selectedTimeRange && tool.id !== 'expand'"
        @click="selectTool(tool.id)"
        :title="tool.name"
      >
        <span v-if="tool.id === 'clone'" v-html="tool.icon"></span>
        <span v-else>{{ tool.icon }}</span>
      </button>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col bg-white">
      <!-- Editor section -->
      <div class="h-1/2 border-b border-gray-200 p-6 chart-area">
        <div class="flex justify-between mb-6">
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
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              @click="handleImportData"
              title="Import Data"
            >
              Import Data
            </button>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              @click="exportAllSeries"
              title="Export All Series"
            >
              Export All
            </button>
            <button
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              :disabled="!store.canUndo"
              @click="store.undo"
              title="Undo"
            >
              ↩️
            </button>
            <button
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              :disabled="!store.canRedo"
              @click="store.redo"
              title="Redo"
            >
              ↪️
            </button>
          </div>
        </div>
        <TimeSeriesChart
          :series="store.series"
          :height="300"
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
        />
      </div>

      <!-- Divider -->
      <div class="h-px bg-gray-200"></div>

      <!-- View section -->
      <div class="h-1/2 p-4 overflow-y-auto bg-white">
        <TimeSeriesView
          v-for="s in store.series"
          :key="s.id"
          :series="s"
          :isSelected="selectedSeriesId === s.id"
          @click="handleSeriesClick(s.id)"
          @hover="(isHovering) => handleSeriesHover(s.id, isHovering)"
        />
      </div>
    </div>

    <!-- Curve Editor Dialog -->
    <CurveEditor
      v-if="showCurveEditor"
      :visible="showCurveEditor"
      :timeRange="store.selectedTimeRange"
      :seriesId="selectedSeriesId"
      @close="showCurveEditor = false"
      @change="handleCurveChange"
    />

    <!-- Generate Dialog -->
    <GenerateDialog
      v-if="showGenerateDialog"
      :visible="showGenerateDialog"
      :patterns="generatePatterns"
      :targetTime="0"
      @close="showGenerateDialog = false"
      @select="handleGenerateSelect"
    />
    
    <!-- Import Dialog -->
    <ImportDialog
      v-if="showImportDialog"
      :visible="showImportDialog"
      @close="showImportDialog = false"
      @import="handleImportComplete"
    />
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
</style>