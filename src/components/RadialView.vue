<template>
  <div ref="chartContainer" class="w-full h-full relative">
    <!-- 加载动画 -->
    <div v-if="isLoading" class="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
      <div class="flex flex-col items-center gap-2">
        <div 
          :style="{
            '--theme-color-light': THEME_COLOR_LIGHT,
            '--theme-color': THEME_COLOR
          }"
          class="w-8 h-8 border-4 border-[var(--theme-color-light)] border-t-[var(--theme-color)] rounded-full animate-spin"
        ></div>
        <span class="text-sm text-gray-600">loading...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import * as d3 from 'd3';
import { reqDataDay } from '@/api';
import { GREEN_GRADIENT_COLORS, THEME_COLOR, THEME_COLOR_LIGHT, WEEKDAY_COLOR, WEEKEND_COLOR } from '@/utils/constants';
import { useDatasetStore } from '../stores/datasetStore';
import { reqDataDayMultiple } from '../api';
import { generateGradientColors } from '@/utils/generateColor';

const datasetStore = useDatasetStore();

const chartContainer = ref(null);
const data = ref([]);
const isLoading = ref(false);

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

  // 根据工作日/周末状态选择合适的颜色
  let targetColor;
  if (datasetStore.getShowWeekday && datasetStore.getShowWeekend) {
    targetColor = THEME_COLOR; // 两者都选择时使用主题色
  } else if (datasetStore.getShowWeekday) {
    targetColor = WEEKDAY_COLOR; // 只选择工作日时
  } else if (datasetStore.getShowWeekend) {
    targetColor = WEEKEND_COLOR; // 只选择周末时
  } else {
    targetColor = THEME_COLOR; // 默认使用主题色
  }

  // 使用generateGradientColors生成渐变色数组
  const gradientColors = generateGradientColors(targetColor, 10); // 10个渐变层次

  // 创建颜色比例尺
  const colorScale = d3.scaleQuantize()
    .domain([minValue, maxValue])
    .range(gradientColors);

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
  if (!datasetStore.getCurrentDataset) {
    data.value = [];
    return;
  }

  try {
    isLoading.value = true;
    if (datasetStore.getCurrentDataset === 'capture'){
      data.value = await reqDataDayMultiple(datasetStore.getCurrentDataset, datasetStore.selectedVariable);
    }
    else {
      let dayType = 'day' 
      if (datasetStore.getShowWeekday & !datasetStore.getShowWeekend) dayType = 'weekday'
      if (!datasetStore.getShowWeekday & datasetStore.getShowWeekend) dayType = 'weekend'
      data.value = await reqDataDay(datasetStore.getCurrentDataset, dayType);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    isLoading.value = false;
  }
};

// 监听容器大小变化
const resizeObserver = new ResizeObserver(() => {
  if (data.value.length && chartContainer.value) {
    createConcentricDonuts(data.value, chartContainer.value);
  }
});

onMounted(() => {
  if (chartContainer.value) {
    resizeObserver.observe(chartContainer.value);
  }
});

onUnmounted(() => {
  if (chartContainer.value) {
    resizeObserver.unobserve(chartContainer.value);
  }
});

// 监听数据集变化
watch(() => datasetStore.getCurrentDataset, async (newDataset) => {
  if (newDataset) {
    await fetchData();
  } else {
    data.value = [];
  }
}, { immediate: true });

// 监听数据变化
watch(data, async (newData) => {
  if (newData.length && chartContainer.value) {
    await nextTick();
    createConcentricDonuts(newData, chartContainer.value);
  }
}, { deep: true });

// 监听选中用户变化
watch(() => datasetStore.getSelectedUserId, (newUserId) => {
  if (!chartContainer.value) return;

  const svg = d3.select(chartContainer.value).select('svg');
  if (!svg.empty()) {
    // 移除所有高亮效果
    svg.selectAll('path')
      .attr('stroke', 'none');

    // 如果有选中的用户，高亮对应的圆环
    if (newUserId !== null) {
      svg.selectAll(`.ring-${newUserId} path`)
        .attr('stroke', '#FFD700')
        .attr('stroke-width', 2)
        .raise();
    }
  }
});

// 监听工作日和非工作日的选择变化
watch([
  () => datasetStore.getShowWeekday,
  () => datasetStore.getShowWeekend
], async () => {
  await fetchData();
});
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