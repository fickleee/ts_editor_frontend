<script setup>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import { formatTime } from '../utils/csvUtils'

const props = defineProps({
  series: Array,
  height: Number,
  showGrid: Boolean,
  selection: Object,
  multiSelect: Boolean,
  activeTool: String,
  isMainChart: Boolean,
  hoveredSeriesId: String,
  hoverTime: Number,
  isGeneratePreview: {
    type: Boolean,
    default: false
  },
  timeAxisConfig: {
    type: Object,
    default: () => ({
      marginLeft: 60,
      marginRight: 20,
      width: null
    })
  }
})

const emit = defineEmits([
  'click',
  'drag',
  'dragStart',
  'dragEnd',
  'selectionComplete',
  'seriesClick',
  'hover'
])

const chartRef = ref()
const svg = ref()
const margin = { top: 20, right: 20, bottom: 30, left: 50 }
const isDragging = ref(false)
const dragStartX = ref(null)
const dragStartY = ref(null)
const selections = ref([])

const colors = ['#2563eb', '#dc2626', '#16a34a']

// Helper function to create safe selector from series ID
const getSeriesSelector = (id) => {
  return `series-${id.replace(/[\s.]/g, '_')}`
}

const initChart = () => {
  if (!chartRef.value) return

  // Clear previous SVG
  d3.select(chartRef.value).selectAll('*').remove()

  const container = chartRef.value
  const containerWidth = container.clientWidth
  const containerHeight = props.height || container.clientHeight || 400

  // Create SVG with viewBox for better scaling
  svg.value = d3.select(chartRef.value)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const g = svg.value.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const width = containerWidth - margin.left - margin.right
  const height = containerHeight - margin.top - margin.bottom

  // Create scales
  const xScale = d3.scaleLinear()
    .domain([0, 24])
    .range([0, width])

  const yScale = d3.scaleLinear()
    .domain([0, 10])
    .range([height, 0])

  // Add grid
  if (props.showGrid && props.isMainChart) {
    // Vertical grid lines (every hour)
    g.selectAll('line.vertical-grid')
      .data(d3.range(0, 25, 2))
      .enter()
      .append('line')
      .attr('class', 'vertical-grid')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')

    // Horizontal grid lines
    g.selectAll('line.horizontal-grid')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'horizontal-grid')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
  }

  // Add time divider lines only for main chart
  if (props.isMainChart) {
    const timeMarkers = [0, 6, 12, 18, 24]
    g.selectAll('line.time-divider')
      .data(timeMarkers)
      .enter()
      .append('line')
      .attr('class', 'time-divider')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', -margin.top)
      .attr('y2', height)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 2)
  }

  // Configure axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(props.isGeneratePreview ? 4 : (props.isMainChart ? 12 : 6))
    .tickFormat(d => formatTime(+d))

  const yAxis = d3.axisLeft(yScale)
    .ticks(props.isMainChart ? 5 : 3)
    .tickFormat(d => d.toFixed(1))

  // Add x-axis
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis)
    .selectAll('text')
    .style('font-size', props.isMainChart ? '10px' : '8px')

  // Add y-axis
  g.append('g')
    .attr('class', 'y-axis')
    .call(yAxis)
    .selectAll('text')
    .style('font-size', props.isMainChart ? '10px' : '8px')

  // Create line generator
  const line = d3.line()
    .x(d => xScale(d.time))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX)

  // Draw lines
  props.series.forEach((s, i) => {
    if (!s.visible) return

    const color = colors[i % colors.length]
    const isHovered = props.hoveredSeriesId === s.id
    
    const seriesGroup = g.append('g')
      .attr('class', `series-group ${getSeriesSelector(s.id)}`)
      .attr('data-series-id', s.id)

    seriesGroup.append('path')
      .datum(s.data)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', props.isMainChart ? 
        (isHovered ? 3 : 2) : 1.5)
      .attr('d', line)
      .attr('data-series-id', s.id)
      
    if (props.isMainChart) {
      seriesGroup.append('path')
        .datum(s.data)
        .attr('class', 'line-hover-area')
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 20)
        .attr('d', line)
        .attr('data-series-id', s.id)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation()
          emit('seriesClick', s.id)
        })
    }
    
    if (isHovered && props.isMainChart) {
      seriesGroup.raise()
    }
  })

  // Add selection highlights
  if (props.multiSelect && selections.value.length > 0) {
    selections.value.forEach((selection, i) => {
      g.append('rect')
        .attr('class', 'selection')
        .attr('x', xScale(selection.start))
        .attr('y', 0)
        .attr('width', xScale(selection.end) - xScale(selection.start))
        .attr('height', height)
        .attr('fill', 'rgba(147, 51, 234, 0.2)')
        .attr('stroke', 'rgb(147, 51, 234)')
        .attr('stroke-width', 1)
    })
  } else if (props.selection) {
    g.append('rect')
      .attr('class', 'selection')
      .attr('x', xScale(props.selection.start))
      .attr('y', 0)
      .attr('width', xScale(props.selection.end) - xScale(props.selection.start))
      .attr('height', height)
      .attr('fill', 'rgba(147, 51, 234, 0.2)')
      .attr('stroke', 'rgb(147, 51, 234)')
      .attr('stroke-width', 1)
  }

  // Create a group for hover elements that will always be on top
  const hoverGroup = svg.value.append('g')
    .attr('class', 'hover-group')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Add hover elements
  const hoverLine = hoverGroup.append('line')
    .attr('class', 'hover-line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', 'rgb(147, 51, 234)')
    .attr('stroke-width', 1)
    .style('display', 'none')

  const hoverLabel = hoverGroup.append('text')
    .attr('class', 'hover-label')
    .attr('y', -5)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgb(147, 51, 234)')
    .style('display', 'none')
    .style('background', 'white')
    .style('padding', '2px 4px')

  const hoverValue = hoverGroup.append('text')
    .attr('class', 'hover-value')
    .attr('x', -5)
    .attr('text-anchor', 'end')
    .attr('fill', 'rgb(147, 51, 234)')
    .style('display', 'none')

  // Add interaction overlay
  const overlay = g.append('rect')
    .attr('class', 'overlay')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'none')
    .style('pointer-events', 'all')

  // Handle mouse events
  overlay
    .on('mousemove', (event) => {
      const [x, y] = d3.pointer(event)
      const time = xScale.invert(x)
      const value = yScale.invert(y)
      
      if (props.selection && (props.activeTool === 'move-x' || props.activeTool === 'move-y')) {
        const isInSelection = time >= props.selection.start && time <= props.selection.end
        overlay.style('cursor', isInSelection ? (props.activeTool === 'move-x' ? 'ew-resize' : 'ns-resize') : 'default')
      } else {
        overlay.style('cursor', 'default')
      }

      hoverLine
        .attr('x1', x)
        .attr('x2', x)
        .style('display', null)

      hoverLabel
        .attr('x', x)
        .text(formatTime(time))
        .style('display', null)

      hoverValue
        .attr('y', y)
        .text(value.toFixed(2))
        .style('display', null)

      if (props.isMainChart) {
        emit('hover', time)
      }

      if (isDragging.value && dragStartX.value !== null) {
        const startTime = xScale.invert(dragStartX.value)
        const startValue = dragStartY.value ? yScale.invert(dragStartY.value) : 0
        emit('drag', {
          start: Math.min(startTime, time),
          end: Math.max(startTime, time)
        }, {
          start: Math.min(startValue, value),
          end: Math.max(startValue, value)
        }, { x, y })
      }
    })
    .on('mouseleave', () => {
      hoverLine.style('display', 'none')
      hoverLabel.style('display', 'none')
      hoverValue.style('display', 'none')
      if (props.isMainChart) {
        emit('hover', null)
      }
    })
    .on('mousedown', (event) => {
      const [x, y] = d3.pointer(event)
      dragStartX.value = x
      dragStartY.value = y
      isDragging.value = true
      emit('dragStart', { x, y })
      event.preventDefault()
    })
    .on('mouseup', (event) => {
      if (dragStartX.value !== null) {
        const [x, y] = d3.pointer(event)
        const time = xScale.invert(x)
        const value = yScale.invert(y)
        
        if (props.multiSelect) {
          const startTime = xScale.invert(dragStartX.value)
          selections.value.push({
            start: Math.min(startTime, time),
            end: Math.max(startTime, time)
          })
          selections.value.sort((a, b) => a.start - b.start)
          initChart()
          emit('selectionComplete', selections.value)
        }
        
        emit('click', time, value)
      }
      dragStartX.value = null
      dragStartY.value = null
      isDragging.value = false
      emit('dragEnd')
    })

  // Update hover line position if hoverTime prop is provided
  if (props.hoverTime !== undefined && props.hoverTime !== null) {
    const x = xScale(props.hoverTime)
    hoverLine
      .attr('x1', x)
      .attr('x2', x)
      .style('display', null)
  }
}

// Watch for hover time changes
watch(() => props.hoverTime, (newTime) => {
  if (!svg.value) return
  
  const width = chartRef.value.clientWidth - margin.left - margin.right
  const xScale = d3.scaleLinear()
    .domain([0, 24])
    .range([0, width])
    
  const hoverLine = svg.value.select('.hover-line')
  
  if (newTime !== null) {
    const x = xScale(newTime)
    hoverLine
      .attr('x1', x)
      .attr('x2', x)
      .style('display', null)
  } else {
    hoverLine.style('display', 'none')
  }
}, { immediate: true })

// Update line thickness when hoveredSeriesId changes
watch(() => props.hoveredSeriesId, (newId) => {
  if (!svg.value || !props.isMainChart) return
  
  props.series.forEach(s => {
    if (!s.visible) return
    
    const isHovered = newId === s.id
    const selector = getSeriesSelector(s.id)
    const seriesGroup = svg.value.select(`.${selector}`)
    
    if (!seriesGroup.empty()) {
      seriesGroup.select('.line')
        .attr('stroke-width', isHovered ? 3 : 2)
      
      if (isHovered) {
        seriesGroup.raise()
      }
    }
  })
}, { immediate: true })

watch(() => props.series, initChart, { deep: true })
watch(() => props.selection, initChart)
watch(() => props.multiSelect, (newValue) => {
  if (!newValue) {
    selections.value = []
  }
  initChart()
})
watch(() => props.activeTool, initChart)

onMounted(() => {
  initChart()
  
  const observer = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      initChart()
    })
  })
  
  if (chartRef.value) {
    observer.observe(chartRef.value)
  }
})
</script>

<template>
  <div ref="chartRef" class="w-full h-full bg-white"></div>
</template>

<style scoped>
.hover-line {
  pointer-events: none;
  stroke-width: 1;
  stroke-dasharray: 4,4;
}

.hover-label,
.hover-value {
  pointer-events: none;
  font-size: 10px;
  fill: #6B7280;
}

.hover-label {
  background: white;
  padding: 2px 4px;
}

.selection {
  fill: rgba(124, 58, 237, 0.1);
  stroke: #7C3AED;
  stroke-width: 1;
  stroke-dasharray: 4,4;
}

.time-divider {
  pointer-events: none;
}

.x-axis text,
.y-axis text {
  font-family: 'Inter', sans-serif;
}

.x-axis line,
.y-axis line {
  stroke: #E5E7EB;
  stroke-width: 1;
}

.x-axis path,
.y-axis path {
  stroke: none;
}

.line-hover-area {
  cursor: pointer;
}
</style>