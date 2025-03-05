<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { TimePoint } from '../types'
import { parseCSV } from '../utils/csvUtils'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  import: [data: { id: string, data: TimePoint[] }[]]
}>()

const file = ref<File | null>(null)
const isLoading = ref(false)
const previewData = ref<string | null>(null)
const seriesName = ref<string>('')
const timeFormat = ref<string>('yyyy/m/d hh:mm')
const dateColumn = ref<number>(1) // Default to second column for activity data
const valueColumn = ref<number>(2) // Default to third column for steps
const hasHeader = ref(true)
const idColumn = ref<number>(0) // New: column for ID
const useIdAsName = ref(true) // New: option to use ID as series name

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    file.value = target.files[0]
    previewFile()
    
    // Auto-detect series name from filename if not using ID
    if (!useIdAsName.value && !seriesName.value) {
      const filename = file.value.name
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")
      seriesName.value = nameWithoutExt
    }
  }
}

const previewFile = () => {
  if (!file.value) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      // Show first 10 lines of the file
      const content = e.target.result as string
      const lines = content.split('\n').slice(0, 10).join('\n')
      previewData.value = lines
      
      // Auto-detect format based on first line
      autoDetectFormat(lines)
    }
  }
  reader.readAsText(file.value)
}

const autoDetectFormat = (content: string) => {
  const lines = content.split('\n')
  if (lines.length === 0) return
  
  // Check if first line is a header
  const firstLine = lines[0].trim()
  if (firstLine.toLowerCase().includes('activityminute') && 
      firstLine.toLowerCase().includes('steps') && 
      firstLine.toLowerCase().includes('id')) {
    hasHeader.value = true
    timeFormat.value = 'm/d/yyyy hh:mm:ss aa' // Set format for activity data
    dateColumn.value = 1 // ActivityMinute column
    valueColumn.value = 2 // Steps column
    idColumn.value = 0 // ID column
    useIdAsName.value = true
  } else if (firstLine.toLowerCase().includes('time') && firstLine.toLowerCase().includes('value')) {
    hasHeader.value = true
    timeFormat.value = 'yyyy/m/d hh:mm'
    dateColumn.value = 0
    valueColumn.value = 1
    useIdAsName.value = false
  }
  
  // Check data line (first or second depending on header)
  const dataLine = hasHeader.value && lines.length > 1 ? lines[1].trim() : firstLine
  const parts = dataLine.split(',')
  
  if (parts.length >= 2) {
    // Try to detect date format if not already set
    if (!timeFormat.value) {
      const potentialDateStr = parts[dateColumn.value].trim()
      
      if (potentialDateStr.includes('/') && potentialDateStr.toLowerCase().includes('am') || 
          potentialDateStr.toLowerCase().includes('pm')) {
        timeFormat.value = 'm/d/yyyy hh:mm:ss aa'
      } else if (potentialDateStr.includes('/') && potentialDateStr.includes(':')) {
        timeFormat.value = 'yyyy/m/d hh:mm'
      } else if (potentialDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        timeFormat.value = 'yyyy-mm-dd'
      } else if (!isNaN(parseFloat(potentialDateStr))) {
        timeFormat.value = 'hours'
      }
    }
  }
}

const handleImport = async () => {
  if (!file.value) {
    ElMessage.warning('Please select a file to import')
    return
  }
  
  if (!useIdAsName.value && !seriesName.value) {
    ElMessage.warning('Please enter a series name')
    return
  }
  
  isLoading.value = true
  
  try {
    const reader = new FileReader()
    
    const fileContent = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsText(file.value as File)
    })
    
    if (useIdAsName.value) {
      // Group data by ID and create multiple series
      const seriesMap = new Map<string, TimePoint[]>()
      
      const lines = fileContent.split('\n')
      const startRow = hasHeader.value ? 1 : 0
      
      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const parts = line.split(',')
        if (parts.length <= Math.max(idColumn.value, dateColumn.value, valueColumn.value)) continue
        
        const id = parts[idColumn.value].trim()
        const timeStr = parts[dateColumn.value].trim()
        const valueStr = parts[valueColumn.value].trim()
        const value = parseFloat(valueStr)
        
        if (isNaN(value)) continue
        
        try {
          const time = parseTimeString(timeStr, timeFormat.value)
          if (!isNaN(time)) {
            if (!seriesMap.has(id)) {
              seriesMap.set(id, [])
            }
            seriesMap.get(id)?.push({ time, value })
          }
        } catch (error) {
          console.warn(`Error parsing time: ${error}`)
        }
      }
      
      // Convert map to array of series
      const allSeries = Array.from(seriesMap.entries()).map(([id, data]) => ({
        id: `ID_${id}`,
        data: data.sort((a, b) => a.time - b.time)
      }))
      
      emit('import', allSeries)
    } else {
      // Single series import
      const parsedData = parseCSV(fileContent, {
        timeFormat: timeFormat.value,
        dateColumn: dateColumn.value,
        valueColumn: valueColumn.value,
        hasHeader: hasHeader.value
      })
      
      if (parsedData.length === 0) {
        ElMessage.error('No valid data found in the file')
        isLoading.value = false
        return
      }
      
      emit('import', [{
        id: seriesName.value,
        data: parsedData
      }])
    }
    
    ElMessage.success('Data imported successfully')
    
    // Reset form
    file.value = null
    previewData.value = null
    seriesName.value = ''
    
  } catch (error) {
    console.error('Error importing data:', error)
    ElMessage.error('Failed to import data')
  } finally {
    isLoading.value = false
  }
}

const parseTimeString = (timeStr: string, format: string): number => {
  const date = new Date(timeStr)
  if (!isNaN(date.getTime())) {
    return (date.getHours() + (date.getMinutes() / 60)) % 24
  }
  throw new Error('Invalid date format')
}

// Prevent clicks in the dialog from propagating to the background
const handleDialogClick = (event: MouseEvent) => {
  event.stopPropagation()
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-lg p-6 max-w-xl w-full" @click="handleDialogClick">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">Import Data</h3>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      
      <div class="space-y-4">
        <div v-if="!useIdAsName">
          <label class="block text-sm font-medium text-gray-700 mb-1">Series Name</label>
          <input 
            v-model="seriesName" 
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Enter a name for this data series"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
          <select 
            v-model="timeFormat"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="m/d/yyyy hh:mm:ss aa">M/D/YYYY HH:MM:SS AM/PM (e.g., 3/12/2016 12:00:00 AM)</option>
            <option value="yyyy/m/d hh:mm">YYYY/M/D H:MM (e.g., 2015/2/1 0:00)</option>
            <option value="hours">Hours (0-24)</option>
            <option value="minutes">Minutes</option>
            <option value="seconds">Seconds</option>
            <option value="timestamp">Timestamp (milliseconds)</option>
            <option value="hhmm">HHMM Format (e.g., 0830 for 8:30 AM)</option>
            <option value="hhmmss">HHMMSS Format (e.g., 083045 for 8:30:45 AM)</option>
            <option value="iso">ISO Date (e.g., 2023-01-01T08:30:00)</option>
            <option value="date">Date (e.g., 2023/01/01 08:30)</option>
            <option value="yyyy-mm-dd">YYYY-MM-DD (e.g., 2023-01-01)</option>
            <option value="mm/dd/yyyy">MM/DD/YYYY (e.g., 01/01/2023)</option>
            <option value="dd/mm/yyyy">DD/MM/YYYY (e.g., 01/01/2023)</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            Select the format of time values in your CSV file. All times will be converted to hours (0-24).
          </p>
        </div>
        
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1">Date/Time Column</label>
            <input 
              v-model.number="dateColumn" 
              type="number" 
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p class="text-xs text-gray-500 mt-1">Column index (0 = first column)</p>
          </div>
          
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1">Value Column</label>
            <input 
              v-model.number="valueColumn" 
              type="number" 
              min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p class="text-xs text-gray-500 mt-1">Column index (0 = first column)</p>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="flex items-center">
            <input 
              id="has-header" 
              v-model="hasHeader" 
              type="checkbox" 
              class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label for="has-header" class="ml-2 block text-sm text-gray-700">
              File has header row
            </label>
          </div>
          
          <div class="flex items-center">
            <input 
              id="use-id" 
              v-model="useIdAsName" 
              type="checkbox" 
              class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label for="use-id" class="ml-2 block text-sm text-gray-700">
              Use ID column for series names
            </label>
          </div>
        </div>
        
        <div v-if="useIdAsName" class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">ID Column</label>
          <input 
            v-model.number="idColumn" 
            type="number" 
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p class="text-xs text-gray-500 mt-1">Column index for ID values</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
          <p class="text-xs text-gray-500 mb-2">
            The CSV file should have date/time values and data values in the specified columns.
          </p>
          <input 
            type="file" 
            accept=".csv" 
            @change="handleFileChange"
            class="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100"
          />
        </div>
        
        <div v-if="previewData" class="mt-4">
          <h4 class="text-sm font-medium text-gray-700 mb-1">Preview</h4>
          <pre class="bg-gray-50 p-3 rounded-md text-xs font-mono overflow-x-auto max-h-40">{{ previewData }}</pre>
        </div>
      </div>
      
      <div class="mt-6 flex justify-end gap-2">
        <button
          @click="emit('close')"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          @click="handleImport"
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          :disabled="isLoading || !file"
        >
          <span v-if="isLoading">Importing...</span>
          <span v-else>Import</span>
        </button>
      </div>
    </div>
  </div>
</template>