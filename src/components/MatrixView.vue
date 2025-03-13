<template>
  <div ref="container" class="w-full h-full flex">
    <!-- 左侧用户概览区域 -->
    <div ref="overviewContainer" class="w-1/5 h-full border-r border-gray-200">
      <div ref="userOverviewChart" class="w-full h-full"></div>
    </div>
    <!-- 右侧矩阵视图区域 -->
    <div class="flex-1 h-full relative">
      <!-- 使用absolute定位确保滚动区域不会撑开容器 -->
      <div class="absolute inset-0 overflow-auto">
        <div ref="matrixContainer" class="w-full" :style="{ height: `${distributionData.length * userStripHeight}px`, minWidth: '100%' }">
          <div ref="matrixChart"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { reqDataDay, reqDataDistribution, reqDataOriginal } from '@/api';

const container = ref(null);
const userOverviewChart = ref(null);
const matrixContainer = ref(null);
const matrixChart = ref(null);
const allUserData = ref([]);
const distributionData = ref([]);

// 用户条带高度(像素)
const userStripHeight = 100;

// 创建用户概览图表
const createUserOverview = (data, container) => {
  // 添加数据检查
  if (!data || !data.length) {
    console.warn('No data received');
    return;
  }

  // 清除已有的图表
  d3.select(container).selectAll('*').remove();

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // 为每个用户分配等高的区域
  const userHeight = containerHeight / data.length;
  
  // 创建 SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight);

  // 计算所有数据的时间范围和值的范围
  const allValues = data.flatMap(user => user.res.map(item => item.value));
  const timeRange = [0, data[0].res.length - 1];
  const valueRange = [Math.min(...allValues), Math.max(...allValues)];

  // 创建比例尺
  const xScale = d3.scaleLinear()
    .domain(timeRange)
    .range([40, containerWidth - 10]); // 左侧留出更多空间显示用户ID

  // 为每个用户创建时间序列图
  data.forEach((user, index) => {
    const yScale = d3.scaleLinear()
      .domain(valueRange)
      .range([userHeight - 5, 5]); // 稍微减小边距

    // 创建用户组
    const userGroup = svg.append('g')
      .attr('class', `user-${user.id}`)
      .attr('transform', `translate(0, ${index * userHeight})`);

    // 添加边框
    userGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', containerWidth)
      .attr('height', userHeight)
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // 创建折线生成器
    const line = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // 绘制折线
    userGroup.append('path')
      .datum(user.res)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 1.5);

    // 添加用户标签
    userGroup.append('text')
      .attr('x', 5)
      .attr('y', userHeight / 2)
      .attr('dy', '0.35em')
      .text(`User ${user.id}`)
      .attr('font-size', '12px')
      .attr('fill', '#666');
  });
};

// 创建矩阵视图
const createMatrixView = (data, container) => {
  // 添加数据检查
  if (!data || !data.length) {
    console.warn('No data received');
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

  // 计算box plot的宽度
  const boxWidth = containerWidth / 48 * 0.8; // 每个box plot占用80%的可用宽度

  // 为每个用户创建一个组
  data.forEach((user, userIndex) => {
    const userGroup = svg.append('g')
      .attr('class', `user-${user.id}`)
      .attr('transform', `translate(0, ${userIndex * userStripHeight})`);
    
    // 计算该用户所有时间点的数据范围
    const allValues = user.distribution.flatMap(timePoint => timePoint.values);
    const minValue = d3.min(allValues);
    const maxValue = d3.max(allValues);
    
    // 为该用户创建统一的比例尺
    const yScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([userStripHeight - 10, 10]);

    // 处理每个时间点的数据
    user.distribution.forEach((timePoint, timeIndex) => {
      // 计算box plot的位置
      const x = (containerWidth / 48) * timeIndex;
      
      // 计算box plot的统计值
      const values = timePoint.values;
      const sorted = values.sort((a, b) => a - b);
      const q1 = d3.quantile(sorted, 0.25);
      const median = d3.quantile(sorted, 0.5);
      const q3 = d3.quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const min = Math.max(q1 - 1.5 * iqr, d3.min(values));
      const max = Math.min(q3 + 1.5 * iqr, d3.max(values));

      // 绘制box plot
      const boxGroup = userGroup.append('g')
        .attr('transform', `translate(${x}, 0)`);

      // 绘制中位线
      boxGroup.append('line')
        .attr('x1', boxWidth * 0.25)
        .attr('x2', boxWidth * 0.75)
        .attr('y1', yScale(median))
        .attr('y2', yScale(median))
        .attr('stroke', '#000')
        .attr('stroke-width', 2);

      // 绘制box
      boxGroup.append('rect')
        .attr('x', boxWidth * 0.25)
        .attr('y', yScale(q3))
        .attr('width', boxWidth * 0.5)
        .attr('height', yScale(q1) - yScale(q3))
        .attr('fill', '#69b3a2')
        .attr('stroke', '#000');

      // 绘制上须线
      boxGroup.append('line')
        .attr('x1', boxWidth * 0.5)
        .attr('x2', boxWidth * 0.5)
        .attr('y1', yScale(q3))
        .attr('y2', yScale(max))
        .attr('stroke', '#000');

      // 绘制下须线
      boxGroup.append('line')
        .attr('x1', boxWidth * 0.5)
        .attr('x2', boxWidth * 0.5)
        .attr('y1', yScale(q1))
        .attr('y2', yScale(min))
        .attr('stroke', '#000');

      // 绘制上下横线
      boxGroup.append('line')
        .attr('x1', boxWidth * 0.25)
        .attr('x2', boxWidth * 0.75)
        .attr('y1', yScale(max))
        .attr('y2', yScale(max))
        .attr('stroke', '#000');

      boxGroup.append('line')
        .attr('x1', boxWidth * 0.25)
        .attr('x2', boxWidth * 0.75)
        .attr('y1', yScale(min))
        .attr('y2', yScale(min))
        .attr('stroke', '#000');

      // 添加异常值
      values.forEach(v => {
        if (v < min || v > max) {
          boxGroup.append('circle')
            .attr('cx', boxWidth * 0.5)
            .attr('cy', yScale(v))
            .attr('r', 2)
            .attr('fill', 'red');
        }
      });
    });

    // 添加用户标签
    userGroup.append('text')
      .attr('x', 5)
      .attr('y', userStripHeight / 2)
      .attr('dy', '0.35em')
      .text(`User ${user.id}`)
      .attr('font-size', '12px')
      .attr('fill', '#666');
  });
};

// 获取数据
const fetchData = async () => {
  try {
    // 获取用户概览数据
    const overviewRes = await reqDataDay();
    const originalRes = await reqDataOriginal('step');
    console.log(originalRes);
    
    allUserData.value = overviewRes;
    if (userOverviewChart.value) {
      setTimeout(() => {
        createUserOverview(allUserData.value, userOverviewChart.value);
      }, 0);
    }

    // 获取分布数据用于boxplot
    const distributionRes = await reqDataDistribution('step');
    distributionData.value = distributionRes;
    if (matrixChart.value) {
      setTimeout(() => {
        createMatrixView(distributionData.value, matrixChart.value);
      }, 0);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

// 监听容器大小变化
const resizeObserver = new ResizeObserver(() => {
  if (allUserData.value.length) {
    if (userOverviewChart.value) {
      createUserOverview(allUserData.value, userOverviewChart.value);
    }
  }
  if (distributionData.value.length) {
    if (matrixChart.value) {
      createMatrixView(distributionData.value, matrixChart.value);
    }
  }
});

onMounted(() => {
  setTimeout(() => {
    fetchData();
    if (userOverviewChart.value) {
      resizeObserver.observe(userOverviewChart.value);
    }
    if (matrixChart.value) {
      resizeObserver.observe(matrixChart.value);
    }
  }, 0);
});

onUnmounted(() => {
  if (userOverviewChart.value) {
    resizeObserver.unobserve(userOverviewChart.value);
  }
  if (matrixChart.value) {
    resizeObserver.unobserve(matrixChart.value);
  }
});

// 监听数据变化
watch([allUserData, distributionData], ([newOverviewData, newDistributionData]) => {
  if (newOverviewData.length && userOverviewChart.value) {
    createUserOverview(newOverviewData, userOverviewChart.value);
  }
  if (newDistributionData.length && matrixChart.value) {
    createMatrixView(newDistributionData, matrixChart.value);
  }
}, { deep: true });
</script>