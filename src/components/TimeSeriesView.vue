<script setup>
import { ref } from 'vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import { downloadCSV } from '../utils/csvUtils'

const props = defineProps({
  series: Object,
  isSelected: Boolean
})

const emit = defineEmits(['click', 'hover'])

const toggleVisibility = () => {
  props.series.visible = !props.series.visible
}

const getTypeClass = (type) => {
  return `time-series-tag ${type.toLowerCase()}`
}

const handleClick = () => {
  emit('click')
}

const handleMouseEnter = () => {
  emit('hover', true)
}

const handleMouseLeave = () => {
  emit('hover', false)
}

const exportSeries = (event) => {
  event.stopPropagation()
  downloadCSV(props.series.data, `${props.series.id}_export.csv`)
}
</script>

<template>
  <div 
    class="time-series-item p-4 cursor-pointer transition-all duration-200"
    :class="{ 'bg-purple-50 border-l-4 border-purple-500': isSelected }"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="flex items-center gap-4 mb-2">
      <button 
        @click.stop="toggleVisibility" 
        class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
      >
        <span v-if="series.visible" class="text-gray-800">
          <svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M9.37047 5.33344C8.38867 5.33344 7.59272 6.12935 7.59272 7.11122C7.59272 8.09309 8.38867 8.889 9.37047 8.889C10.3524 8.889 11.1482 8.0931 11.1482 7.11122C11.1482 6.12934 10.3524 5.33344 9.37047 5.33344ZM5.81494 7.11122C5.81494 5.14749 7.40685 3.55566 9.37047 3.55566C11.3342 3.55566 12.926 5.1475 12.926 7.11122C12.926 9.07494 11.3342 10.6668 9.37047 10.6668C7.40685 10.6668 5.81494 9.07495 5.81494 7.11122Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M0.0408457 6.84475C1.28655 2.8786 4.99136 0 9.37086 0C13.7503 0 17.4551 2.87863 18.7009 6.84475C18.7553 7.01815 18.7553 7.20407 18.7009 7.37747C17.4551 11.3436 13.7503 14.2222 9.37086 14.2222C4.99136 14.2222 1.28654 11.3436 0.040845 7.37747C-0.0136153 7.20407 -0.013615 7.01815 0.0408457 6.84475ZM1.8258 7.11111C2.92422 10.2192 5.88876 12.4444 9.37086 12.4444C12.8529 12.4444 15.8175 10.2192 16.9159 7.11111C15.8175 4.00306 12.8529 1.77778 9.37086 1.77778C5.88876 1.77778 2.92423 4.00304 1.8258 7.11111Z" fill="currentColor"/>
          </svg>
        </span>
        <span v-else class="text-gray-400">
          <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.48177 1L17.4818 17M7.56557 7.14546C7.101 7.62542 6.8151 8.27929 6.8151 9C6.8151 10.4728 8.00904 11.6667 9.48175 11.6667C10.2129 11.6667 10.8753 11.3724 11.357 10.896M4.59288 4.24191C2.90461 5.35586 1.61868 7.03017 1 9C2.13267 12.6063 5.50183 15.2222 9.48193 15.2222C11.2498 15.2222 12.8972 14.7061 14.2816 13.8164M8.59286 2.82168C8.88531 2.79265 9.18193 2.77778 9.48193 2.77778C13.4621 2.77778 16.8313 5.3937 17.9639 9C17.7144 9.79467 17.3562 10.5412 16.9068 11.2222" stroke="currentColor" stroke-width="1.77778" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>
      
      <div class="flex items-center gap-2">
        <span :class="getTypeClass(series.type)">{{ series.type }}</span>
        <span class="font-medium text-gray-900">{{ series.id }}</span>
        <span v-if="series.parentId" class="text-sm text-gray-500">
          from {{ series.parentId }}
        </span>
      </div>
      
      <button 
        @click.stop="exportSeries"
        class="ml-auto text-sm px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
        title="Export as CSV"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 16L12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 13L12 16L15 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 16.7428C21.2215 15.734 22 14.2079 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 16L12 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Export
      </button>
    </div>
    
    <div class="pl-10">
      <TimeSeriesChart
        :series="[series]"
        :height="80"
        :showGrid="false"
        :isMainChart="false"
      />
    </div>
  </div>
</template>

<style scoped>
.time-series-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.time-series-tag.original {
  background-color: #E5E7EB;
  color: #4B5563;
}

.time-series-tag.lf {
  background-color: #FEF3C7;
  color: #92400E;
}

.time-series-tag.hf {
  background-color: #E0E7FF;
  color: #3730A3;
}

.time-series-item {
  border-left: 4px solid transparent;
}

.time-series-item:hover {
  background-color: #F9FAFB;
}
</style>