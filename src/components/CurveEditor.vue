<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  visible: Boolean,
  timeRange: Object,
  seriesId: String
})

const emit = defineEmits(['close', 'change'])

const editorRef = ref()
const controlPoints = ref([
  { x: 0, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 1, y: 1 }
])

// Computed property for the title
const editorTitle = computed(() => {
  if (props.seriesId) {
    return `Curve Editor - Series ${props.seriesId}`
  }
  return 'Curve Editor'
})

// Computed property for the preview curve
const previewCurve = computed(() => {
  // Generate a smooth curve with more points for preview
  const points = []
  const numPoints = 100
  
  // Use d3's curve interpolation to generate smooth points
  const curveInterpolate = d3.scaleLinear()
    .domain(controlPoints.value.map(p => p.x))
    .range(controlPoints.value.map(p => p.y))
    .clamp(true)
  
  for (let i = 0; i <= numPoints; i++) {
    const x = i / numPoints
    points.push({
      x: x,
      y: curveInterpolate(x)
    })
  }
  
  return points
})

const initEditor = () => {
  if (!editorRef.value) return

  const width = 300
  const height = 300
  const margin = { top: 20, right: 20, bottom: 30, left: 30 }

  // Clear previous SVG
  d3.select(editorRef.value).selectAll('*').remove()

  // Create SVG
  const svg = d3.select(editorRef.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Create scales
  const xScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, width - margin.left - margin.right])

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([height - margin.top - margin.bottom, 0])

  // Add grid
  const grid = g.append('g')
    .attr('class', 'grid')
    .style('stroke', '#e5e7eb')
    .style('stroke-width', 0.5)

  // Vertical grid lines
  grid.selectAll('line.vertical')
    .data(d3.range(0, 1.1, 0.1))
    .enter()
    .append('line')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', height - margin.top - margin.bottom)

  // Horizontal grid lines
  grid.selectAll('line.horizontal')
    .data(d3.range(0, 1.1, 0.1))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', width - margin.left - margin.right)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))

  // Add reference line
  g.append('line')
    .attr('class', 'reference')
    .attr('x1', xScale(0))
    .attr('y1', yScale(0))
    .attr('x2', xScale(1))
    .attr('y2', yScale(1))
    .style('stroke', '#9ca3af')
    .style('stroke-width', 1)
    .style('stroke-dasharray', '4,4')

  // Create curve line
  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveBasis)

  // Draw the preview curve with more points for smoothness
  const path = g.append('path')
    .datum(previewCurve.value)
    .attr('class', 'curve')
    .attr('fill', 'none')
    .attr('stroke', 'rgb(147, 51, 234)')
    .attr('stroke-width', 2)
    .attr('d', line)

  // Add control points
  const points = g.selectAll('circle')
    .data(controlPoints.value)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', 6)
    .attr('fill', 'white')
    .attr('stroke', 'rgb(147, 51, 234)')
    .attr('stroke-width', 2)
    .call(d3.drag()
      .on('drag', (event, d) => {
        // Reduce sensitivity by applying a damping factor
        const dampingFactor = 0.3 // Lower value = less sensitive
        
        // Calculate the damped movement
        const rawX = xScale.invert(event.x)
        const rawY = yScale.invert(event.y)
        
        // Get current position
        const currentX = d.x
        const currentY = d.y
        
        // Apply damping to movement
        const dampedX = currentX + (rawX - currentX) * dampingFactor
        const dampedY = currentY + (rawY - currentY) * dampingFactor
        
        // Clamp values to valid range
        const x = Math.max(0, Math.min(1, dampedX))
        const y = Math.max(0, Math.min(1, dampedY))
        
        // Only allow vertical movement for end points
        if (d === controlPoints.value[0] || d === controlPoints.value[controlPoints.value.length - 1]) {
          d.y = y
        } else {
          d.x = x
          d.y = y
        }

        // Update visual elements
        d3.select(event.sourceEvent.target)
          .attr('cx', xScale(d.x))
          .attr('cy', yScale(d.y))
        
        // Update the preview curve
        path.datum(previewCurve.value)
          .attr('d', line)
      }))

  // Add axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(5)
    .tickFormat(d => (d * 100) + '%')

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(d => (d * 100) + '%')

  g.append('g')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(xAxis)

  g.append('g')
    .call(yAxis)
    
  // Add button to add control point
  const addPointButton = d3.select(editorRef.value)
    .append('button')
    .attr('class', 'add-point-btn')
    .text('Add Control Point')
    .style('position', 'absolute')
    .style('top', '10px')
    .style('right', '10px')
    .style('padding', '4px 8px')
    .style('background-color', '#f3e8ff')
    .style('color', '#7e22ce')
    .style('border', '1px solid #d8b4fe')
    .style('border-radius', '4px')
    .style('cursor', 'pointer')
    
  addPointButton.on('click', () => {
    // Find a good position for the new point
    const points = controlPoints.value
    if (points.length >= 8) return // Limit to 8 points
    
    // Find the largest gap between points
    let maxGap = 0
    let insertIndex = 1
    
    for (let i = 0; i < points.length - 1; i++) {
      const gap = points[i+1].x - points[i].x
      if (gap > maxGap) {
        maxGap = gap
        insertIndex = i + 1
      }
    }
    
    // Insert a new point in the middle of the largest gap
    const newX = (points[insertIndex-1].x + points[insertIndex].x) / 2
    const newY = (points[insertIndex-1].y + points[insertIndex].y) / 2
    
    points.splice(insertIndex, 0, { x: newX, y: newY })
    
    // Redraw the editor
    initEditor()
  })
}

const handleApply = () => {
  emit('change', controlPoints.value, props.seriesId)
  emit('close')
}

const handleReset = () => {
  // Reset to linear curve
  controlPoints.value = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 }
  ]
  initEditor()
}

// Preset curves
const applyPreset = (preset) => {
  switch (preset) {
    case 'ease-in':
      controlPoints.value = [
        { x: 0, y: 0 },
        { x: 0.4, y: 0.1 },
        { x: 0.8, y: 0.6 },
        { x: 1, y: 1 }
      ]
      break
    case 'ease-out':
      controlPoints.value = [
        { x: 0, y: 0 },
        { x: 0.2, y: 0.4 },
        { x: 0.6, y: 0.9 },
        { x: 1, y: 1 }
      ]
      break
    case 'ease-in-out':
      controlPoints.value = [
        { x: 0, y: 0 },
        { x: 0.2, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.8, y: 0.9 },
        { x: 1, y: 1 }
      ]
      break
    case 's-curve':
      controlPoints.value = [
        { x: 0, y: 0 },
        { x: 0.3, y: 0.2 },
        { x: 0.7, y: 0.8 },
        { x: 1, y: 1 }
      ]
      break
    case 'step':
      controlPoints.value = [
        { x: 0, y: 0 },
        { x: 0.25, y: 0 },
        { x: 0.25, y: 0.33 },
        { x: 0.5, y: 0.33 },
        { x: 0.5, y: 0.66 },
        { x: 0.75, y: 0.66 },
        { x: 0.75, y: 1 },
        { x: 1, y: 1 }
      ]
      break
  }
  initEditor()
}

// Prevent clicks in the dialog from propagating to the background
const handleDialogClick = (event) => {
  event.stopPropagation()
}

onMounted(() => {
  if (props.visible) {
    initEditor()
  }
})

watch(() => props.visible, (visible) => {
  if (visible) {
    // Reset to default curve when opening
    controlPoints.value = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 }
    ]
    initEditor()
  }
})

// Update the editor when control points change
watch(() => controlPoints.value, () => {
  if (props.visible) {
    initEditor()
  }
}, { deep: true })
</script>

<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-lg p-6 max-w-xl" @click="handleDialogClick">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">{{ editorTitle }}</h3>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      
      <!-- Presets -->
      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-2">Presets:</p>
        <div class="flex flex-wrap gap-2">
          <button 
            @click="applyPreset('ease-in')" 
            class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            Ease In
          </button>
          <button 
            @click="applyPreset('ease-out')" 
            class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            Ease Out
          </button>
          <button 
            @click="applyPreset('ease-in-out')" 
            class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            Ease In-Out
          </button>
          <button 
            @click="applyPreset('s-curve')" 
            class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            S-Curve
          </button>
          <button 
            @click="applyPreset('step')" 
            class="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            Step
          </button>
        </div>
      </div>
      
      <div class="relative">
        <div ref="editorRef" class="curve-editor"></div>
        
        <div class="text-xs text-gray-500 mt-2">
          <p>Drag control points to adjust the curve. End points can only move vertically.</p>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end gap-2">
        <button
          @click="handleReset"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Reset
        </button>
        <button
          @click="emit('close')"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          @click="handleApply"
          class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.curve-editor {
  width: 300px;
  height: 300px;
  position: relative;
}
</style>