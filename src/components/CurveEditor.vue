<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  visible: Boolean,
  timeRange: Object,
  seriesId: String
})

const emit = defineEmits(['change'])

const svgRef = ref(null)
const controlPoints = ref([
  { x: 0, y: 0, fixed: true },
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 1, y: 1, fixed: true }
])
const isDragging = ref(false)
const activePointIndex = ref(null)

const margin = { top: 20, right: 30, bottom: 30, left: 40 }

// 修改为扩展范围到 200%
const yDomain = [0, 2] // 扩展到 200%

const initChart = () => {
  if (!svgRef.value || !props.visible) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const width = svgRef.value.clientWidth
  const height = svgRef.value.clientHeight
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const xScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, innerWidth])

  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([innerHeight, 0])

  // 添加网格线
  g.append('g')
    .attr('class', 'grid')
    .selectAll('line.horizontal')
    .data(d3.range(0, 2.1, 0.5)) // 更稀疏的网格线
    .enter()
    .append('line')
    .attr('class', 'horizontal')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .attr('stroke', d => d === 1 ? '#9CA3AF' : '#E5E7EB')
    .attr('stroke-width', d => d === 1 ? 1.5 : 0.5)
    .attr('stroke-dasharray', d => d === 1 ? null : '2,2')

  g.append('g')
    .attr('class', 'grid')
    .selectAll('line.vertical')
    .data(d3.range(0, 1.1, 0.1))
    .enter()
    .append('line')
    .attr('class', 'vertical')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .attr('stroke', '#E5E7EB')
    .attr('stroke-width', 0.5)
    .attr('stroke-dasharray', '2,2')

  // 添加比例示意
  g.append('text')
    .attr('x', innerWidth - 120)
    .attr('y', 15)
    .attr('text-anchor', 'start')
    .attr('fill', '#9CA3AF')
    .attr('font-size', '10px')
    .text('200% ↑')

  g.append('text')
    .attr('x', innerWidth - 120)
    .attr('y', innerHeight / 2)
    .attr('text-anchor', 'start')
    .attr('fill', '#9CA3AF')
    .attr('font-size', '10px')
    .text('100% →')

  g.append('text')
    .attr('x', innerWidth - 120)
    .attr('y', innerHeight - 5)
    .attr('text-anchor', 'start')
    .attr('fill', '#9CA3AF')
    .attr('font-size', '10px')
    .text('0% ↓')

  // 添加 x 轴
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d3.format('.1f')))
    .selectAll('text')
    .style('font-size', '10px')

  // 添加 y 轴
  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale)
      .ticks(5) // 减少标注数量
      .tickFormat(d => `${d * 100}%`))
    .selectAll('text')
    .style('font-size', '10px')

  // 创建贝塞尔曲线
  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveBasis)

  // 生成曲线插值点
  const curvePoints = []
  for (let t = 0; t <= 1; t += 0.01) {
    const point = interpolateCurve(controlPoints.value, t)
    curvePoints.push(point)
  }

  // 绘制曲线
  g.append('path')
    .datum(curvePoints)
    .attr('class', 'curve')
    .attr('fill', 'none')
    .attr('stroke', '#7C3AED')
    .attr('stroke-width', 3)
    .attr('d', line)

  // 添加右上角的控制按钮
  const buttonGroup = svg.append('g')
    .attr('class', 'control-buttons')
    .attr('transform', `translate(${width - 65}, 15)`)

  // 添加按钮
  buttonGroup.append('circle')
    .attr('cx', 15)
    .attr('cy', 15)
    .attr('r', 12)
    .attr('fill', '#7C3AED')
    .attr('cursor', 'pointer')
    .on('click', addControlPoint)

  buttonGroup.append('text')
    .attr('x', 15)
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '16px')
    .attr('pointer-events', 'none')
    .text('+')

  buttonGroup.append('circle')
    .attr('cx', 45)
    .attr('cy', 15)
    .attr('r', 12)
    .attr('fill', '#7C3AED')
    .attr('cursor', 'pointer')
    .on('click', removeControlPoint)

  buttonGroup.append('text')
    .attr('x', 45)
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '16px')
    .attr('pointer-events', 'none')
    .text('-')

  // 绘制控制点
  const pointsGroup = g.append('g')
    .attr('class', 'control-points')

  // 创建控制点拖动区域（较大区域提高易用性）
  pointsGroup.selectAll('circle.point-target')
    .data(controlPoints.value)
    .enter()
    .append('circle')
    .attr('class', 'point-target')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', 15) // 增大拖动区域
    .attr('fill', 'transparent')
    .attr('cursor', d => d.fixed ? 'not-allowed' : 'grab')
    .on('mousedown', function(event, d) {
      if (d.fixed) return
      
      isDragging.value = true
      activePointIndex.value = controlPoints.value.findIndex(p => p === d)
      
      d3.select(this.parentNode)
        .selectAll('circle.point')
        .filter((pd, i) => i === activePointIndex.value)
        .attr('r', 8) // 增大激活点
        .attr('stroke-width', 2.5)
        
      event.preventDefault()
    })

  // 绘制可见控制点
  pointsGroup.selectAll('circle.point')
    .data(controlPoints.value)
    .enter()
    .append('circle')
    .attr('class', 'point')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', 6)
    .attr('fill', d => d.fixed ? '#9CA3AF' : '#7C3AED')
    .attr('stroke', '#FFFFFF')
    .attr('stroke-width', 2)

  // 添加拖动效果
  svg.on('mousemove', function(event) {
    if (!isDragging.value || activePointIndex.value === null) return
    
    const coords = d3.pointer(event)
    const x = xScale.invert(coords[0] - margin.left)
    const y = yScale.invert(coords[1] - margin.top)
    
    // 确保不会超出左右边界
    const prevPoint = controlPoints.value[activePointIndex.value - 1]
    const nextPoint = controlPoints.value[activePointIndex.value + 1]
    
    let newX = x
    if (prevPoint && newX <= prevPoint.x) newX = prevPoint.x + 0.01
    if (nextPoint && newX >= nextPoint.x) newX = nextPoint.x - 0.01
    
    // 限制 y 值在域范围内
    const newY = Math.max(0, Math.min(yDomain[1], y))
    
    // 更新控制点位置
    controlPoints.value[activePointIndex.value] = {
      ...controlPoints.value[activePointIndex.value],
      x: newX,
      y: newY
    }
    
    // 更新视图
    initChart()
    
    // 触发变更事件
    emit('change', [...controlPoints.value])
  })
  
  svg.on('mouseup', function() {
    isDragging.value = false
    activePointIndex.value = null
    
    // 恢复所有点大小
    d3.select(this)
      .selectAll('circle.point')
      .attr('r', 6)
      .attr('stroke-width', 2)
  })
  
  svg.on('mouseleave', function() {
    isDragging.value = false
    activePointIndex.value = null
    
    // 恢复所有点大小
    d3.select(this)
      .selectAll('circle.point')
      .attr('r', 6)
      .attr('stroke-width', 2)
  })
  
  // 添加拖动中的视觉指示
  if (isDragging.value && activePointIndex.value !== null) {
    const point = controlPoints.value[activePointIndex.value]
    
    g.append('circle')
      .attr('class', 'drag-indicator')
      .attr('cx', xScale(point.x))
      .attr('cy', yScale(point.y))
      .attr('r', 20)
      .attr('fill', 'rgba(124, 58, 237, 0.1)')
      .attr('stroke', '#7C3AED')
      .attr('stroke-dasharray', '3,3')
  }
}

// 曲线插值函数
const interpolateCurve = (points, t) => {
  let result = { x: 0, y: 0 }
  
  if (points.length === 1) {
    return points[0]
  }
  
  const newPoints = []
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i+1]
    
    newPoints.push({
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    })
  }
  
  return interpolateCurve(newPoints, t)
}

// 添加控制点
const addControlPoint = () => {
  if (controlPoints.value.length >= 8) return
  
  // 寻找最大间隔
  let maxDist = 0
  let insertIndex = 1
  
  for (let i = 0; i < controlPoints.value.length - 1; i++) {
    const dist = controlPoints.value[i+1].x - controlPoints.value[i].x
    if (dist > maxDist) {
      maxDist = dist
      insertIndex = i + 1
    }
  }
  
  // 在最大间隔中间插入新点
  const prev = controlPoints.value[insertIndex - 1]
  const next = controlPoints.value[insertIndex]
  
  const newPoint = {
    x: (prev.x + next.x) / 2,
    y: (prev.y + next.y) / 2
  }
  
  controlPoints.value.splice(insertIndex, 0, newPoint)
  initChart()
  emit('change', [...controlPoints.value])
}

// 删除控制点
const removeControlPoint = () => {
  // 确保至少保留4个点（包括端点）
  if (controlPoints.value.length <= 4) return
  
  // 寻找最小间隔（非固定点）
  let minDist = Infinity
  let removeIndex = null
  
  for (let i = 1; i < controlPoints.value.length - 2; i++) {
    if (!controlPoints.value[i].fixed && !controlPoints.value[i+1].fixed) {
      const dist = controlPoints.value[i+1].x - controlPoints.value[i].x
      if (dist < minDist) {
        minDist = dist
        removeIndex = i
      }
    }
  }
  
  if (removeIndex !== null) {
    controlPoints.value.splice(removeIndex, 1)
    initChart()
    emit('change', [...controlPoints.value])
  }
}

// 应用预设
const applyPreset = (preset) => {
  switch (preset) {
    case 'ease-in':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.4, y: 0.1 },
        { x: 0.8, y: 0.6 },
        { x: 1, y: 1, fixed: true }
      ]
      break
    case 'ease-out':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.2, y: 0.4 },
        { x: 0.6, y: 0.9 },
        { x: 1, y: 1, fixed: true }
      ]
      break
    case 'ease-in-out':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.3, y: 0.1 },
        { x: 0.7, y: 0.9 },
        { x: 1, y: 1, fixed: true }
      ]
      break
    case 's-curve':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.2, y: 0.8 },
        { x: 0.8, y: 0.2 },
        { x: 1, y: 1, fixed: true }
      ]
      break
    case 'step':
      // 改进阶梯形状，使其更像真正的阶梯
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.45, y: 0 },
        { x: 0.45, y: 1 }, // 垂直线段第一点
        { x: 0.55, y: 1 }, // 水平线段
        { x: 0.55, y: 1 }, // 垂直线段第二点
        { x: 1, y: 1, fixed: true }
      ]
      break
    case 'enhance-2x':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.3, y: 0.6 },
        { x: 0.7, y: 1.4 },
        { x: 1, y: 2, fixed: true }
      ]
      break
    case 'enhance-1.5x':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.3, y: 0.5 },
        { x: 0.7, y: 1.0 },
        { x: 1, y: 1.5, fixed: true }
      ]
      break
    case 'reduce-0.5x':
      controlPoints.value = [
        { x: 0, y: 0, fixed: true },
        { x: 0.3, y: 0.25 },
        { x: 0.7, y: 0.4 },
        { x: 1, y: 0.5, fixed: true }
      ]
      break
  }
  
  initChart()
  emit('change', [...controlPoints.value])
}

// 重置到默认
const resetToDefault = () => {
  controlPoints.value = [
    { x: 0, y: 0, fixed: true },
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 1, y: 1, fixed: true }
  ]
  
  initChart()
  emit('change', [...controlPoints.value])
}

watch(() => props.visible, (visible) => {
  if (visible) {
    initChart()
  }
})

// 监听尺寸变化并重新渲染
onMounted(() => {
  if (props.visible) {
    initChart()
  }
  
  window.addEventListener('resize', initChart)
})

defineExpose({
  applyPreset,
  resetToDefault
})
</script>

<template>
  <div class="curve-editor h-full flex flex-col">
    <div class="flex-1 overflow-hidden">
      <svg ref="svgRef" class="w-full h-full"></svg>
    </div>
    <div class="flex-none mt-8 pt-2 border-t border-gray-200">
      <div class="flex flex-wrap gap-2 items-center">
        <button 
          v-for="preset in ['enhance-2x', 'enhance-1.5x', 'reduce-0.5x']"
          :key="preset"
          @click="applyPreset(preset)"
          class="px-3 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
        >
          {{ preset === 'enhance-2x' ? '200% Enhance' : 
             preset === 'enhance-1.5x' ? '150% Enhance' : 
             '50% Reduce' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.curve-editor {
  position: relative;
}

:deep(.x-axis path),
:deep(.y-axis path) {
  stroke: #E5E7EB;
}

:deep(.x-axis line),
:deep(.y-axis line) {
  stroke: #E5E7EB;
}

:deep(.control-points .point) {
  transition: r 0.1s ease, stroke-width 0.1s ease;
}

:deep(.control-buttons) {
  cursor: pointer;
}

:deep(.control-buttons circle:hover) {
  filter: brightness(1.1);
}
</style>