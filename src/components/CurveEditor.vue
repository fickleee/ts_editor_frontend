<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  visible: Boolean,
  timeRange: Object,
  seriesId: String
})

const emit = defineEmits(['change'])

const editorRef = ref()
const controlPoints = ref([
  { x: 0, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 1, y: 1 }
])

let resizeObserver = null
let resizeTimeout = null

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

  // Get container dimensions
  const container = editorRef.value
  const containerWidth = container.clientWidth
  const containerHeight = Math.min(containerWidth, 300) // Limit height to avoid excessive space
  
  const margin = { top: 20, right: 20, bottom: 30, left: 30 }
  const width = containerWidth
  const height = containerHeight

  // Clear previous SVG
  d3.select(container).selectAll('*').remove()

  // Create SVG with viewBox for better scaling
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

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
        d3.select(event.sourceEvent. target)
          .attr('cx', xScale(d.x))
          .attr('cy', yScale(d.y))
        
        // Update the preview curve
        path.datum(previewCurve.value)
          .attr('d', line)

        // Emit change event
        emit('change', controlPoints.value)
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
  emit('change', controlPoints.value)
}

const resetToDefault = () => {
  controlPoints.value = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 }
  ]
  emit('change', controlPoints.value)
}

const addControlPoint = () => {
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
  emit('change', points)
}

// Handle resize with debouncing
const handleResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  
  resizeTimeout = setTimeout(() => {
    if (props.visible) {
      initEditor()
    }
  }, 100)
}

onMounted(() => {
  if (props.visible) {
    initEditor()
  }
  
  // Set up resize observer with debouncing
  resizeObserver = new ResizeObserver(handleResize)
  
  if (editorRef.value) {
    resizeObserver.observe(editorRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
})

watch(() => props.visible, (visible) => {
  if (visible) {
    initEditor()
  }
})

// Update the editor when control points change
watch(() => controlPoints.value, () => {
  if (props.visible) {
    initEditor()
  }
}, { deep: true })

// Expose methods to parent
defineExpose({
  applyPreset,
  resetToDefault
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-hidden">
      <div ref="editorRef" class="w-full h-full"></div>
      
      <div class="text-xs text-gray-500 mt-2">
        <p>Drag control points to adjust the curve. End points can only move vertically.</p>
      </div>
    </div>

    <button 
      @click="addControlPoint"
      class="mt-4 w-full px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100 border border-purple-200"
    >
      Add Control Point
    </button>
  </div>
</template>

<style scoped>
:deep(.grid line) {
  stroke: #e5e7eb;
  stroke-width: 0.5;
}

:deep(.x-axis path),
:deep(.y-axis path) {
  stroke: none;
}

:deep(.x-axis line),
:deep(.y-axis line) {
  stroke: #e5e7eb;
  stroke-width: 1;
}

:deep(.x-axis text),
:deep(.y-axis text) {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  fill: #6b7280;
}
</style>