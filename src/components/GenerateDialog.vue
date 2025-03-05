<script setup>
import { ref } from 'vue'
import TimeSeriesChart from './TimeSeriesChart.vue'

const props = defineProps({
  visible: Boolean,
  patterns: Array,
  targetTime: Number
})

const emit = defineEmits(['close', 'select'])

const selectedPattern = ref(null)

const handleSelect = (pattern) => {
  selectedPattern.value = pattern
}

const handleApply = () => {
  if (selectedPattern.value) {
    emit('select', selectedPattern.value)
  }
  emit('close')
}

// Prevent clicks in the dialog from propagating to the background
const handleDialogClick = (event) => {
  event.stopPropagation()
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] flex flex-col" @click="handleDialogClick">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">Replace with Similar Pattern</h3>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      
      <div class="flex-1 overflow-y-auto">
        <div v-if="patterns.length === 0" class="text-center py-8 text-gray-500">
          No similar patterns found
        </div>
        
        <div v-else class="space-y-4">
          <div 
            v-for="pattern in patterns" 
            :key="`${pattern.start}-${pattern.end}`"
            class="border rounded-lg p-4 cursor-pointer transition-all duration-200"
            :class="{
              'border-purple-500 bg-purple-50': selectedPattern === pattern,
              'border-gray-200 hover:border-purple-300': selectedPattern !== pattern
            }"
            @click="handleSelect(pattern)"
          >
            <div class="flex justify-between items-center mb-2">
              <div class="text-sm text-gray-600">
                Time range: {{ pattern.start.toFixed(2) }} - {{ pattern.end.toFixed(2) }}
              </div>
              <div class="text-sm text-purple-600">
                Similarity: {{ (pattern.similarity * 100).toFixed(1) }}%
              </div>
            </div>
            <TimeSeriesChart
              :series="[{ id: 'preview', data: pattern.data, type: 'original', visible: true }]"
              :height="120"
              :showGrid="false"
              :isMainChart="false"
            />
          </div>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end gap-2 pt-4 border-t">
        <button
          @click="emit('close')"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          @click="handleApply"
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          :disabled="!selectedPattern"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
</template>