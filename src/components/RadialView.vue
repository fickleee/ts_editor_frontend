<template>
  <div ref="chartContainer" class="w-full h-full"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { reqDataStep } from '@/api';

const chartContainer = ref(null);
const data = ref([]);

// 创建同心环形图
const createConcentricDonuts = (data, container) => {
  // 添加数据检查
  console.log('Received data:', data);
  if (!data || !data.length) {
    console.warn('No data received');
    return;
  }

  // 清除已有的图表
  d3.select(container).selectAll('*').remove();

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // 移除 margin，简化计算
  const width = containerWidth;
  const height = containerHeight;
  const centerRadius = Math.min(width, height) / 3; // 调整半径大小，避免太大

  // 修改 SVG 创建方式
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])  // 修改 viewBox
    .append('g')
    .attr('transform', `translate(${width/2}, ${height/2})`); // 移动到中心

  // 计算每个环的参数
  const ringWidth = centerRadius / (data.length + 1);

  // 为每个用户创建一个环
  data.forEach((user, index) => {
    const radius = (index + 1) * ringWidth;

    const arc = d3.arc()
      .innerRadius(radius - ringWidth * 0.8)
      .outerRadius(radius)
      .padAngle(0.01);

    const pie = d3.pie()
      .sort(null)
      .value(d => 1);

    const ring = svg.append('g')
      .attr('class', `ring-${user.id}`);

    // 添加调试信息
    console.log('Creating paths for user:', user);
    console.log('Pie data:', pie(user.res));

    const paths = ring.selectAll('path')
      .data(pie(user.res))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10]) // 使用不同的颜色
      .style('opacity', 0.7);

    console.log(`Created ${paths.size()} paths for user ${user.id}`);
  });
};

// 获取数据
const fetchData = async () => {
  try {
    const res = await reqDataStep();
    console.log('API response:', res); // 添加数据日志
    data.value = res;
    if (chartContainer.value) {
      // 确保容器已经渲染
      setTimeout(() => {
        createConcentricDonuts(data.value, chartContainer.value);
      }, 0);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

// 监听容器大小变化
const resizeObserver = new ResizeObserver(() => {
  if (data.value.length && chartContainer.value) {
    createConcentricDonuts(data.value, chartContainer.value);
  }
});

onMounted(() => {
  // 确保容器已经渲染完成
  setTimeout(() => {
    fetchData();
    if (chartContainer.value) {
      resizeObserver.observe(chartContainer.value);
    }
  }, 0);
});

onUnmounted(() => {
  if (chartContainer.value) {
    resizeObserver.unobserve(chartContainer.value);
  }
});

// 监听数据变化
watch(data, (newData) => {
  if (newData.length && chartContainer.value) {
    createConcentricDonuts(newData, chartContainer.value);
  }
}, { deep: true });
</script>

<style scoped>
.w-full {
  width: 100%;
}
.h-full {
  height: 100%;
}

.tooltip {
  font-size: 12px;
  pointer-events: none;
}
</style> 