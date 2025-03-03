<template>
  <div ref="chartContainer" class="w-full h-full"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { reqDataStep } from '@/api';
import { GREEN_GRADIENT_COLORS } from '@/utils/constants';

const chartContainer = ref(null);
const data = ref([]);

// 创建同心环形图
const createConcentricDonuts = (data, container) => {
  // 添加数据检查
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
  const centerRadius = Math.min(width, height) * 9 / 20;
  
  // 设置最小起始半径
  const minRadius = centerRadius * 0.2; // 最小半径设为总半径的20%

  // 创建 SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .append('g')
    .attr('transform', `translate(${width/2}, ${height/2})`);

  // 计算所有数据的最大值和最小值
  const allValues = data.flatMap(user => user.res.map(item => item.value));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  // 创建颜色比例尺
  const colorScale = d3.scaleQuantize()
    .domain([minValue, maxValue])
    .range(GREEN_GRADIENT_COLORS);

  // 计算每个环的参数
  const availableRadius = centerRadius - minRadius; // 可用半径空间
  const ringWidth = availableRadius / data.length; // 每个环的宽度

  // 为每个用户创建一个环
  data.forEach((user, index) => {
    const radius = minRadius + (index + 1) * ringWidth; // 从最小半径开始累加

    const arc = d3.arc()
      .innerRadius(radius - ringWidth * 0.8)
      .outerRadius(radius)
      .padAngle(0); // 移除扇形之间的间隙

    const pie = d3.pie()
      .sort(null)
      .value(d => 1)  // 每个扇形占相等的角度
      .padAngle(0);   // 确保扇形之间没有间隙

    const ring = svg.append('g')
      .attr('class', `ring-${user.id}`)
      .attr('data-ring-index', index);  // 添加环的索引

    ring.selectAll('path')
      .data(pie(user.res))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colorScale(user.res[i].value))
      .style('opacity', 1)
      .attr('stroke', 'none')
      .attr('stroke-width', 1)
      .attr('data-index', (d, i) => i)
      .attr('data-ring-index', index)  // 添加环的索引到扇形
      .on('mouseover', function(event, d) {
        const index = d3.select(this).attr('data-index');
        const ringIndex = d3.select(this).attr('data-ring-index');
        
        // 高亮相同时刻的扇形
        svg.selectAll('path')
          .filter(function() {
            return d3.select(this).attr('data-index') === index;
          })
          .attr('stroke', '#FFD700')
          .raise();

        // 高亮整个圆环
        svg.selectAll('path')
          .filter(function() {
            return d3.select(this).attr('data-ring-index') === ringIndex;
          })
          .attr('stroke', '#FFD700')
          .raise();
      })
      .on('mouseout', function(event, d) {
        // 移除所有高亮效果
        svg.selectAll('path')
          .attr('stroke', 'none');
      });
  });

  // 添加鼠标事件的CSS
  svg.style('pointer-events', 'all');
};

// 获取数据
const fetchData = async () => {
  try {
    const res = await reqDataStep();
    data.value = res;
    if (chartContainer.value) {
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