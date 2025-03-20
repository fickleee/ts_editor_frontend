<template>
  <div ref="chartContainer" class="w-full h-full relative">
    <!-- 范围选择滑块 -->
    <div 
      v-if="datasetStore.getCurrentDataset && data.length > 0 && !isLoading" 
      class="absolute top-2 right-2 z-40 w-60 slider-container"
    >
      <div class="flex items-center">
        <!-- <span 
            class="text-sm min-w-[30px] text-right font-semibold" 
            :style="{ color: THEME_COLOR }"
          >range:</span> -->
        <span 
          class="text-sm mr-4 min-w-[20px] text-right font-semibold" 
          :style="{ color: THEME_COLOR }"
        >range: {{ valueRange[0] }}</span>
        <el-slider 
          v-model="valueRange" 
          range 
          :min="minValue" 
          :max="maxValue" 
          :step="sliderStep"
          :disabled="isLoading"
          @change="handleRangeChange"
          class="compact-slider flex-1"
          :style="{
            '--el-slider-main-bg-color': THEME_COLOR,
            '--el-color-primary': THEME_COLOR
          }"
        />
        <span 
          class="text-sm ml-4 min-w-[30px] text-left font-semibold"
          :style="{ color: THEME_COLOR }"
        >{{ valueRange[1] }}</span>
      </div>
    </div>
    
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
        <span :style="{ color: THEME_COLOR }" class="text-sm font-semibold">loading...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import * as d3 from 'd3';
import { reqDataDay } from '@/api';
import { THEME_COLOR, THEME_COLOR_LIGHT, WEEKDAY_COLOR, WEEKEND_COLOR } from '@/utils/constants';
import { useDatasetStore } from '../stores/datasetStore';
import { reqDataDayMultiple } from '../api';
import { generateGradientColors } from '@/utils/generateColor';

const datasetStore = useDatasetStore();

const chartContainer = ref(null);
const data = ref([]);
const isLoading = ref(false);

// 滑块相关状态
const minValue = ref(0);
const maxValue = ref(100);
const valueRange = ref([0, 100]);
const allValues = ref([]);

// 在 script setup 部分添加 sliderStep 计算
const sliderStep = computed(() => {
  if (!data.value || !data.value.length) return 0.1;
  const range = maxValue.value - minValue.value;
  return range <= 20 ? 0.1 : 1;
});

// 处理滑块范围变化
const handleRangeChange = () => {
  if (data.value.length && chartContainer.value) {
    // 在滑块值变化后更新图表
    nextTick(() => {
      createConcentricDonuts(data.value, chartContainer.value);
    });
  }
};

// 计算并更新滑块的范围值
const updateSliderRange = () => {
  if (data.value && data.value.length > 0) {
    // 提取所有数据点的值
    allValues.value = data.value.flatMap(user => user.res.map(item => item.value));
    
    // 计算最小值和最大值，精确到1位小数
    minValue.value = Math.floor(Math.min(...allValues.value) * 10) / 10;
    maxValue.value = Math.ceil(Math.max(...allValues.value) * 10) / 10;
    
    // 设置初始范围为全范围
    valueRange.value = [minValue.value, maxValue.value];
  }
};

// 创建同心环形图
const createConcentricDonuts = (data, container) => {
  // 添加数据检查
  if (!data || !data.length) {
    console.warn('No data received');
    return;
  }
  // 清除已有的图表
  d3.select(container).selectAll('svg').remove();

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
    .style('position', 'absolute')
    .style('z-index', '10')
    .append('g')
    .attr('transform', `translate(${width/2}, ${height/2})`);

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

  // 创建颜色比例尺 - 使用滑块的选择范围，而不是数据的最小最大值
  const colorScale = d3.scaleQuantize()
    .domain([valueRange.value[0], valueRange.value[1]])
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
      .attr('data-ring-index', index)  // 添加环的索引
      .attr('data-user-name', user.name || `User ${user.id}`); // 添加用户名称

    ring.selectAll('path')
      .data(pie(user.res))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => {
        const value = user.res[i].value;
        // 根据值与范围的关系确定颜色
        if (value < valueRange.value[0]) {
          // 小于范围下限，使用最低颜色
          return gradientColors[0];
        } else if (value > valueRange.value[1]) {
          // 大于范围上限，使用最高颜色
          return gradientColors[gradientColors.length - 1];
        } else {
          // 在范围内，使用比例尺正常映射
          return colorScale(value);
        }
      })
      .style('opacity', 1) // 所有数据点都完全不透明
      .attr('stroke', 'none')
      .attr('stroke-width', 1)
      .attr('data-index', (d, i) => i)
      .attr('data-ring-index', index)  // 添加环的索引到扇形
      .attr('data-value', (d, i) => user.res[i].value) // 添加数值属性
      .on('mouseover', function(event, d) {
        // 更新 store 中的选中用户，触发其他视图的高亮
        datasetStore.setSelectedUserId(user.id);
        datasetStore.setSelectedView('radial');
        const index = d3.select(this).attr('data-index');
        const ringIndex = d3.select(this).attr('data-ring-index');
        
        // 高亮相同时刻的扇形
        svg.selectAll('path')
          .filter(function() {
            return d3.select(this).attr('data-index') === index;
          })
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 1)
          .raise();

        // 高亮整个圆环
        svg.selectAll('path')
          .filter(function() {
            return d3.select(this).attr('data-ring-index') === ringIndex;
          })
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 1)
          .raise();


      })
      .on('mouseout', function(event, d) {
        // 移除所有高亮效果
        svg.selectAll('path')
          .attr('stroke', 'none');
        datasetStore.setSelectedUserId(null);
        datasetStore.setSelectedView(null);
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
    
    // 更新滑块范围
    updateSliderRange();
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

// 监听数据集变量变化
watch(() => datasetStore.selectedVariable, async (newVariable) => {
  if (datasetStore.getCurrentDataset === 'capture' && newVariable) {
    await fetchData();
  }
});

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
    if (datasetStore.getSelectedView !== 'radial') {
      svg.selectAll('path')
        .attr('stroke', 'none');
    }

    // 如果有选中的用户，高亮对应的圆环
    if (newUserId !== null && datasetStore.getSelectedView !== 'radial') {
      svg.selectAll(`.ring-${newUserId} path`)
        .attr('stroke', '#FFD700')
        .attr('stroke-width', 1)
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
  max-width: 200px;
  transition: opacity 0.2s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

/* 滑块样式定制 */
.slider-container :deep(.el-slider) {
  height: 28px;
}

.slider-container :deep(.el-slider__runway) {
  height: 5px;
  margin: 14px 0;
}

.slider-container :deep(.el-slider__bar) {
  height: 5px;
}

.slider-container :deep(.el-slider__button-wrapper) {
  height: 22px;
  width: 22px;
  top: -9px;
}

.slider-container :deep(.el-slider__button) {
  height: 14px;
  width: 14px;
  border-color: var(--el-color-primary);
}
</style> 