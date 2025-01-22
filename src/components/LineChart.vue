<template>
    <div class="w-full h-full">
      <div :ref="(el) => chartRef = el" class="w-full h-full"></div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onUnmounted, watch } from 'vue'
  import * as d3 from 'd3'
  
  const props = defineProps({
    data: {
      type: Array,
      required: true
    },
    color: {
      type: String,
      default: '#41B883'
    }
  })
  
  const chartRef = ref(null)
  let svg = null
  
  const drawChart = () => {
    if (!chartRef.value || !props.data.length) return
  
    // 清除已有的图表
    d3.select(chartRef.value).selectAll('*').remove()
  
    // 设置图表尺寸
    const margin = { top: 10, right: 20, bottom: 10, left: 40 }
    const width = chartRef.value.clientWidth - margin.left - margin.right
    const height = chartRef.value.clientHeight - margin.top - margin.bottom
  
    // 创建SVG容器
    svg = d3.select(chartRef.value)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
  
    // 创建比例尺
    const x = d3.scaleLinear()
      .domain([0, props.data.length - 1])
      .range([0, width])
  
    const y = d3.scaleLinear()
      .domain([d3.min(props.data, d => d.value), d3.max(props.data, d => d.value)])
      .range([height, 0])
      .nice()
  
    // 添加网格线
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat('')
      )
      .style('stroke-opacity', 0.1)
  
    // 绘制线条
    const line = d3.line()
      .x((d, i) => x(i))
      .y(d => y(d.value))
      .curve(d3.curveNatural)
  
    svg.append('path')
      .datum(props.data)
      .attr('fill', 'none')
      .attr('stroke', props.color)
      .attr('stroke-width', 1.5)
      .attr('d', line)
  
    // 添加y轴
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(0))
      .call(g => g.select('.domain').remove())
      .style('font-size', '10px')
  }
  
  watch(() => props.data, drawChart, { deep: true })
  
  onMounted(() => {
    drawChart()
    window.addEventListener('resize', drawChart)
  })
  
  onUnmounted(() => {
    window.removeEventListener('resize', drawChart)
  })
  </script>
  
  