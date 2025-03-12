<template>
  <div ref="container" class="w-full h-full relative">
    <!-- 固定在顶部的概览区域 -->
    <div class="w-full h-[200px] border-b border-gray-300">
      <div ref="overviewChart" class="w-full h-full"></div>
    </div>
    
    <!-- 可滚动的用户数据区域 -->
    <div class="absolute top-[200px] bottom-0 left-0 right-0 overflow-auto">
      <div ref="chartContainer" class="w-full" :style="{ height: `${allUserData.length * userStripHeight}px`, minWidth: '100%' }">
        <div ref="lineChart" class="w-full h-full"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { reqDataStep, reqDataWeek, reqDataOriginal } from '@/api';
import { useDatasetStore } from '../stores/datasetStore';
import { ElMessage } from 'element-plus';

const container = ref(null);
const overviewChart = ref(null);
const chartContainer = ref(null);
const lineChart = ref(null);
const allUserData = ref([]);
const originalData = ref([]);
const datasetStore = useDatasetStore();

// 用户条带高度(像素) - 设置更高以便更好地展示折线图
const userStripHeight = 150;

// 数据聚合级别 - 'day' 或 'week'
const aggregationLevel = ref('day');

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 创建概览图表 - 使用box plot展示所有用户和天数的数据分布
const createOverviewChart = (data, container) => {
  // 添加数据检查
  if (!data || !data.length) {
    console.warn('No original data received for overview');
    return;
  }

  // 清除已有的图表
  d3.select(container).selectAll('*').remove();

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // 创建 SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight);

  
  // 创建一个组用于显示临时的详细数据线图
  const detailGroup = svg.append('g')
    .attr('class', 'detail-view')
    .style('display', 'none');
  

  
  // 计算每30分钟一个box plot，一天共48个
  const boxPlotCount = 48; // 24小时 * 2 (每小时2个30分钟)
  const boxWidth = (containerWidth - 60) / boxPlotCount;
  
  // 准备数据 - 按30分钟聚合
  const aggregatedData = [];
  
  // 初始化48个时间点的数组
  for (let i = 0; i < boxPlotCount; i++) {
    aggregatedData.push([]);
  }
  
  // 每天的分钟数
  const minutesPerDay = 1440;
  // 每个时间段的分钟数
  const minutesPerSlot = 30;
  // 每天的时间段数
  const slotsPerDay = minutesPerDay / minutesPerSlot; // 48
  
  // 遍历所有用户的数据
  data.forEach(user => {
    if (!user.data || !Array.isArray(user.data)) return;
    
    // 假设数据是连续的31天，每天1440分钟
    const daysCount = Math.floor(user.data.length / minutesPerDay);
    
    // 对于每一天
    for (let day = 0; day < daysCount; day++) {
      // 对于每个30分钟时间段
      for (let slot = 0; slot < slotsPerDay; slot++) {
        // 计算这个时间段在这一天的起始和结束分钟索引
        const startMinute = day * minutesPerDay + slot * minutesPerSlot;
        const endMinute = startMinute + minutesPerSlot;
        
        // 收集这个时间段的所有有效数据点
        const slotValues = [];
        for (let i = startMinute; i < endMinute && i < user.data.length; i++) {
          const point = user.data[i];
          if (point && typeof point.value === 'number') {
            slotValues.push(point.value);
          }
        }
        
        // 如果有有效数据，计算这个时间段的平均值并添加到聚合数据中
        if (slotValues.length > 0) {
          const avgValue = slotValues.reduce((sum, val) => sum + val, 0) / slotValues.length;
          // 添加用户ID和日期信息，使用数据点自带的time信息
          aggregatedData[slot].push({
            value: avgValue,
            userId: user.id || 'unknown',
            day: day,
            date: user.data[startMinute].time.split(' ')[0] // 只取日期部分，不要时间
          });
        }
      }
    }
  });
  
  
  // 检查是否有数据
  const hasData = aggregatedData.some(slot => slot.length > 0);
  if (!hasData) {
    console.warn('No valid data points found for box plots');
    
    // 添加错误信息
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', containerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('fill', 'red')
      .text('无法处理数据，请检查数据结构');
    
    return;
  }
  
  // 计算所有数据的值范围，用于Y轴比例尺
  const allValues = aggregatedData.flat().map(item => item.value);
  const minValue = d3.min(allValues) || 0;
  const maxValue = d3.max(allValues) || 1;
  
  // 获取所有唯一的用户ID
  const uniqueUserIds = [...new Set(aggregatedData.flat().map(item => item.userId))];
  
  // 创建颜色比例尺，为每个用户分配一个颜色
  const colorScale = d3.scaleOrdinal()
    .domain(uniqueUserIds)
    .range(d3.schemeCategory10); // 使用D3内置的颜色方案
  
  // 创建比例尺
  const xScale = d3.scaleLinear()
    .domain([0, boxPlotCount - 1])
    .range([60, containerWidth - 20]);
  
  const yScale = d3.scaleLinear()
    .domain([minValue, maxValue])
    .range([containerHeight - 40, 40]);
  
  // 添加X轴
  const xAxis = d3.axisBottom(xScale)
    .tickFormat(d => {
      // 将索引转换为小时:分钟格式
      const hour = Math.floor((d * 30) / 60);
      const minute = (d * 30) % 60;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    })
    .tickValues(d3.range(0, boxPlotCount, 4)); // 每2小时显示一个刻度
  
  svg.append('g')
    .attr('transform', `translate(0, ${containerHeight - 40})`)
    .call(xAxis);
  
  // 添加Y轴
  const yAxis = d3.axisLeft(yScale)
    .ticks(5);
  
  svg.append('g')
    .attr('transform', 'translate(60, 0)')
    .call(yAxis);
  
  // 绘制每个时间点的box plot
  aggregatedData.forEach((values, i) => {
    if (values.length === 0) return;
    
    // 排序数据用于计算四分位数
    const sorted = [...values].sort((a, b) => a.value - b.value);
    const q1 = d3.quantile(sorted.map(d => d.value), 0.25);
    const median = d3.quantile(sorted.map(d => d.value), 0.5);
    const q3 = d3.quantile(sorted.map(d => d.value), 0.75);
    const iqr = q3 - q1;
    const min = Math.max(q1 - 1.5 * iqr, d3.min(sorted.map(d => d.value)));
    const max = Math.min(q3 + 1.5 * iqr, d3.max(sorted.map(d => d.value)));
    
    const x = xScale(i);
    const boxGroup = svg.append('g')
      .attr('transform', `translate(${x}, 0)`);
    
    // 绘制中位线
    boxGroup.append('line')
      .attr('x1', -boxWidth * 0.3)
      .attr('x2', boxWidth * 0.3)
      .attr('y1', yScale(median))
      .attr('y2', yScale(median))
      .attr('stroke', '#000')
      .attr('stroke-width', 2);
    
    // 绘制box
    boxGroup.append('rect')
      .attr('x', -boxWidth * 0.3)
      .attr('y', yScale(q3))
      .attr('width', boxWidth * 0.6)
      .attr('height', yScale(q1) - yScale(q3))
      .attr('fill', '#69b3a2')
      .attr('stroke', '#000');
    
    // 绘制上须线
    boxGroup.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', yScale(q3))
      .attr('y2', yScale(max))
      .attr('stroke', '#000');
    
    // 绘制下须线
    boxGroup.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', yScale(q1))
      .attr('y2', yScale(min))
      .attr('stroke', '#000');
    
    // 绘制上下横线
    boxGroup.append('line')
      .attr('x1', -boxWidth * 0.3)
      .attr('x2', boxWidth * 0.3)
      .attr('y1', yScale(max))
      .attr('y2', yScale(max))
      .attr('stroke', '#000');
    
    boxGroup.append('line')
      .attr('x1', -boxWidth * 0.3)
      .attr('x2', boxWidth * 0.3)
      .attr('y1', yScale(min))
      .attr('y2', yScale(min))
      .attr('stroke', '#000');
    
    // 添加异常值并显示用户和日期信息
    sorted.forEach(dataPoint => {
      if (dataPoint.value < min || dataPoint.value > max) {
        const outlierGroup = boxGroup.append('g');
        
        // 添加异常值点，使用用户ID对应的颜色
        outlierGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', yScale(dataPoint.value))
          .attr('r', 1.5)
          .attr('fill', colorScale(dataPoint.userId))
          .attr('stroke', '#000')
          .attr('stroke-width', 0.3)
          .style('cursor', 'pointer')
          .on('mouseover', function() {
            // 放大异常点
            d3.select(this)
              .attr('r', 3)
              .attr('stroke-width', 1);
            
            // 显示该用户该天的详细数据，传递aggregatedData
            showUserDayDetail(data, dataPoint.userId, dataPoint.day, detailGroup, containerWidth, containerHeight, aggregatedData);
            detailGroup.style('display', null);
          })
          .on('mouseout', function() {
            // 恢复异常点大小
            d3.select(this)
              .attr('r', 1.5)
              .attr('stroke-width', 0.3);
            
            // 隐藏详细数据
            detailGroup.style('display', 'none');
          });
        
        // 添加鼠标悬停提示
        outlierGroup.append('title')
          .text(`用户: ${dataPoint.userId}, 日期: ${dataPoint.date}, 值: ${dataPoint.value.toFixed(2)}`);
      }
    });
    
    // 为箱体添加鼠标悬停提示，显示详细统计信息
    boxGroup.select('rect')
      .append('title')
      .text(`时间: ${Math.floor((i * 30) / 60)}:${((i * 30) % 60).toString().padStart(2, '0')}
最小值: ${min.toFixed(2)}
第一四分位数: ${q1.toFixed(2)}
中位数: ${median.toFixed(2)}
第三四分位数: ${q3.toFixed(2)}
最大值: ${max.toFixed(2)}
数据点数: ${values.length}`);
  });
  

};

// 显示用户某天的详细数据
const showUserDayDetail = (data, userId, day, detailGroup, width, height, aggregatedData) => {
  // 清除之前的线图
  detailGroup.selectAll('.detail-line, .detail-axis, .detail-point, .detail-outlier').remove();
  
  // 查找对应用户的数据
  const userData = data.find(user => user.id === userId || user.id === Number(userId));
  if (!userData || !userData.data) {
    detailGroup.append('text')
      .attr('class', 'detail-line')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'red')
      .text('未找到该用户数据');
    return;
  }
  
  // 提取该天的数据
  const minutesPerDay = 1440;
  const startIndex = day * minutesPerDay;
  const endIndex = (day + 1) * minutesPerDay;
  const dayData = userData.data.slice(startIndex, endIndex);
  
  if (dayData.length === 0) {
    detailGroup.append('text')
      .attr('class', 'detail-line')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'red')
      .text('该天无数据');
    return;
  }
  
  // 复用箱线图的X轴比例尺
  const xScale = d3.scaleLinear()
    .domain([0, 47]) // 48个时间点，索引从0到47
    .range([60, width - 20]);
  
  // 使用与箱线图相同的值范围
  const allValues = aggregatedData.flat().map(item => item.value);
  const minValue = d3.min(allValues) || 0;
  const maxValue = d3.max(allValues) || 1;
  
  const yScale = d3.scaleLinear()
    .domain([minValue, maxValue])
    .range([height - 40, 40]);
  
  // 将分钟数据聚合为30分钟间隔
  const dayAggregatedData = [];
  const minutesPerSlot = 30;
  const slotsPerDay = minutesPerDay / minutesPerSlot; // 48
  
  // 记录异常点所在的时间段和值
  const outlierSlot = Math.floor((startIndex % minutesPerDay) / minutesPerSlot);
  let outlierValue = null;
  
  for (let slot = 0; slot < slotsPerDay; slot++) {
    const startMinute = slot * minutesPerSlot;
    const endMinute = startMinute + minutesPerSlot;
    
    // 收集这个时间段的所有有效数据点
    const slotValues = [];
    for (let i = startMinute; i < endMinute && i < dayData.length; i++) {
      const point = dayData[i];
      if (point && typeof point.value === 'number') {
        slotValues.push(point.value);
      }
    }
    
    // 如果有有效数据，计算这个时间段的平均值
    if (slotValues.length > 0) {
      const avgValue = slotValues.reduce((sum, val) => sum + val, 0) / slotValues.length;
      dayAggregatedData.push({
        slot: slot,
        value: avgValue,
        rawValues: slotValues
      });
      
      // 如果是异常点所在的时间段，记录其值
      if (slot === outlierSlot) {
        outlierValue = avgValue;
      }
    } else {
      // 如果没有数据，添加一个null值，保持数组索引与时间段对应
      dayAggregatedData.push({
        slot: slot,
        value: null,
        rawValues: []
      });
    }
  }
  
  // 创建线生成器
  const line = d3.line()
    .x(d => xScale(d.slot))
    .y(d => yScale(d.value))
    .defined(d => d && d.value !== null)
    .curve(d3.curveMonotoneX);
  
  // 绘制线
  detailGroup.append('path')
    .attr('class', 'detail-line')
    .datum(dayAggregatedData)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', '#2196F3')
    .attr('stroke-width', 4);
  
  // 添加点
  detailGroup.selectAll('.detail-point')
    .data(dayAggregatedData.filter(d => d && d.value !== null))
    .enter()
    .append('circle')
    .attr('class', 'detail-point')
    .attr('cx', d => xScale(d.slot))
    .attr('cy', d => yScale(d.value))
    .attr('r', 2)
    .attr('fill', '#2196F3');
  
  // 标记异常点所在的时间段
  const slotWithOutlier = Math.floor(day * minutesPerDay / minutesPerSlot);
  
  // 添加垂直参考线，标记异常点所在的时间段
  detailGroup.append('line')
    .attr('class', 'detail-line')
    .attr('x1', xScale(slotWithOutlier % 48))
    .attr('x2', xScale(slotWithOutlier % 48))
    .attr('y1', 40)
    .attr('y2', height - 40)
    .attr('stroke', 'red')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '5,5');
};

// 创建折线图表
const createLineChart = (data, container) => {
  // 添加数据检查
  if (!data || !data.length) {
    console.warn('No data received');
    return;
  }

  // 检查数据结构
  if (!data[0] || !data[0].res || !Array.isArray(data[0].res) || !data[0].res.length) {
    console.warn('Invalid data structure', data);
    return;
  }

  // 清除已有的图表
  d3.select(container).selectAll('*').remove();

  const containerWidth = container.clientWidth;
  const totalHeight = data.length * userStripHeight;
  
  // 创建 SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', totalHeight);

  // 计算所有数据的时间范围
  const timeRange = [0, data[0].res.length - 1];
  
  // 计算所有用户的平均值
  const timePointCount = data[0].res.length;
  const avgValues = Array(timePointCount).fill(0);
  
  // 第一步：累加所有用户的值
  data.forEach(user => {
    if (user && user.res && Array.isArray(user.res)) {
      user.res.forEach((point, i) => {
        if (i < timePointCount && point && typeof point.value === 'number') {
          avgValues[i] += point.value;
        }
      });
    }
  });
  
  // 第二步：除以用户数量得到平均值
  const userCount = data.length;
  const avgData = avgValues.map((sum, i) => ({
    value: sum / userCount
  }));
  
  // 计算所有用户数据的全局值范围
  const allValues = data.flatMap(user => user.res.map(point => point.value));
  const minValue = d3.min(allValues) || 0;
  const maxValue = d3.max(allValues) || 1;

  // 创建全局比例尺
  const xScale = d3.scaleLinear()
    .domain(timeRange)
    .range([60, containerWidth - 20]);

  const yScale = d3.scaleLinear()
    .domain([minValue, maxValue])
    .range([userStripHeight - 20, 20]);

  // 为每个用户创建一个组
  data.forEach((user, userIndex) => {
    // 检查用户数据
    if (!user || !user.res || !Array.isArray(user.res) || !user.res.length) {
      console.warn(`Invalid data for user at index ${userIndex}`, user);
      return; // 跳过这个用户
    }

    const userGroup = svg.append('g')
      .attr('class', `user-${user.id || userIndex}`)
      .attr('transform', `translate(0, ${userIndex * userStripHeight})`);

    // 添加用户背景和边框
    userGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', containerWidth)
      .attr('height', userStripHeight)
      .attr('fill', 'white')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);
    
    // 添加X轴网格线
    const xTicks = 12; // 每两小时一条线
    for (let i = 0; i <= xTicks; i++) {
      const xPos = xScale(timeRange[1] * (i / xTicks));
      userGroup.append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', 10)
        .attr('y2', userStripHeight - 10)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '3,3');
    }

    // 添加Y轴网格线
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const yPos = yScale(minValue + (maxValue - minValue) * (i / yTicks));
      userGroup.append('line')
        .attr('x1', 60)
        .attr('x2', containerWidth - 20)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '3,3');
    }
    
    // 创建折线生成器 - 用户数据
    const line = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // 创建折线生成器 - 平均数据
    const avgLine = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // 先绘制平均线（在下层）
    userGroup.append('path')
      .datum(avgData)
      .attr('class', 'avg-line')
      .attr('d', avgLine)
      .attr('fill', 'none')
      .attr('stroke', '#FF5722') // 使用不同颜色区分
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3') // 虚线样式
      .attr('stroke-opacity', 0.6); // 半透明

    // 绘制用户数据线（在上层）
    userGroup.append('path')
      .datum(user.res)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 2);

    // 添加用户标签
    userGroup.append('text')
      .attr('x', 10)
      .attr('y', userStripHeight / 2)
      .attr('dy', '0.35em')
      .text(`User ${user.id}`)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151');

    // 添加时间刻度
    for (let i = 0; i <= 24; i += 4) {
      const hourIndex = Math.floor(timeRange[1] * (i / 24));
      userGroup.append('text')
        .attr('x', xScale(hourIndex))
        .attr('y', userStripHeight - 5)
        .attr('text-anchor', 'middle')
        .text(`${i}h`)
        .attr('font-size', '10px')
        .attr('fill', '#6b7280');
    }
  });
};

// 获取聚合数据的函数
const fetchAggregatedData = async (level) => {
  try {
    let response;
    
    // 根据聚合级别选择不同的API
    if (level === 'day') {
      response = await reqDataStep();
    } else if (level === 'week') {
      response = await reqDataWeek();
    }
    
    // 更新数据
    allUserData.value = response;
    
    // 更新图表
    if (lineChart.value) {
      setTimeout(() => {
        createLineChart(allUserData.value, lineChart.value);
      }, 0);
    }
  } catch (error) {
    console.error(`Error fetching ${level} aggregated data:`, error);
  }
};

// 防抖处理的数据获取函数
const debouncedFetchData = debounce(fetchAggregatedData, 300);

// 获取数据
const fetchData = async () => {
  // 如果没有选择数据集，直接返回
  if (!datasetStore.getCurrentDataset) {
    // 清空现有数据
    allUserData.value = [];
    originalData.value = [];
    return;
  }

  try {
    // 获取用户数据
    const stepRes = await reqDataStep();
    allUserData.value = stepRes;
    
    // 获取原始数据用于概览
    const originalRes = await reqDataOriginal(datasetStore.getCurrentDataset);
    originalData.value = originalRes;
    
    // 更新图表
    if (lineChart.value) {
      setTimeout(() => {
        createLineChart(allUserData.value, lineChart.value);
      }, 0);
    }
    
    // 更新概览图表
    if (overviewChart.value) {
      setTimeout(() => {
        createOverviewChart(originalData.value, overviewChart.value);
      }, 0);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

// 监听容器大小变化
const resizeObserver = new ResizeObserver(() => {
  if (allUserData.value.length && lineChart.value) {
    createLineChart(allUserData.value, lineChart.value);
  }
  if (originalData.value.length && overviewChart.value) {
    createOverviewChart(originalData.value, overviewChart.value);
  }
});

onMounted(() => {
  setTimeout(() => {
    fetchData();
    if (lineChart.value) {
      resizeObserver.observe(lineChart.value);
    }
    if (overviewChart.value) {
      resizeObserver.observe(overviewChart.value);
    }
  }, 0);
});

onUnmounted(() => {
  if (lineChart.value) {
    resizeObserver.unobserve(lineChart.value);
  }
  if (overviewChart.value) {
    resizeObserver.unobserve(overviewChart.value);
  }
});

// 监听数据变化
watch([allUserData, originalData], ([newUserData, newOriginalData]) => {
  if (newUserData.length && lineChart.value) {
    createLineChart(newUserData, lineChart.value);
  }
  if (newOriginalData.length && overviewChart.value) {
    createOverviewChart(newOriginalData, overviewChart.value);
  }
}, { deep: true });

// 监听聚合级别变化
watch(() => datasetStore.aggregationLevel, async (newLevel) => {
  // 检查是否选择了数据集
  if (!datasetStore.getCurrentDataset) {
    console.warn('No dataset selected');
    ElMessage.warning('Please select a dataset first');
    return;
  }

  try {
    // 根据聚合级别获取不同的数据
    if (newLevel === 'day') {
      const stepData = await reqDataStep();
      allUserData.value = stepData;
    } else if (newLevel === 'week') {
      const weekData = await reqDataWeek();
      allUserData.value = weekData;
    }
    
    // 更新图表
    if (lineChart.value) {
      createLineChart(allUserData.value, lineChart.value);
    }
  } catch (error) {
    console.error('Error fetching aggregated data:', error);
    ElMessage.error('Failed to load aggregated data');
  }
}, { immediate: true });

// 监听数据集变化
watch(() => datasetStore.getCurrentDataset, (newDataset) => {
  // 只有当数据集有值时才获取数据
  if (newDataset) {
    fetchData();
  } else {
    // 当数据集被清空时，清空现有数据
    allUserData.value = [];
    originalData.value = [];
  }
}, { immediate: true });
</script>