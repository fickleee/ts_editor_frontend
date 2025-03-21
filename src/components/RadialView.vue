<template>
  <div ref="chartContainer" class="w-full h-full relative">
    <!-- 优化布局切换Tab -->
    <div 
      v-if="datasetStore.getCurrentDataset && data.length > 0 && !isLoading" 
      class="absolute top-2 left-2 z-40"
    >
      <div class="flex bg-gray-100 p-0.5 rounded-full shadow-sm">
        <button
          v-for="option in layoutOptions"
          :key="option.value"
          @click="switchLayout(option.value)"
          :style="{
            '--text-color': THEME_COLOR
          }"
          class="px-2 py-1 text-xs font-semibold rounded-full transition-colors duration-200"
          :class="[
            useOptimizedLayout === option.value
              ? 'bg-white text-[var(--text-color)] shadow-sm'
              : 'text-gray-600 hover:text-[var(--text-color)]'
          ]"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    
    <!-- 范围选择滑块 -->
    <div 
      v-if="datasetStore.getCurrentDataset && data.length > 0 && !isLoading" 
      class="absolute top-2 right-2 z-40 slider-container"
      :style="{ width: sliderWidth + 'px' }"
    >
      <div class="flex items-center">
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
          @input="handleRangeInput"
          @change="handleRangeChange"
          class="compact-slider flex-1"
          :style="{
            '--el-slider-main-bg-color': THEME_COLOR,
            '--el-color-primary': THEME_COLOR
          }"
        />
        <span 
          class="text-sm ml-4 min-w-[20px] text-left font-semibold"
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
import { optimizeRadialLayout } from '@/utils/radialLayout'; // 引入优化布局函数

const datasetStore = useDatasetStore();

const chartContainer = ref(null);
const data = ref([]);
const isLoading = ref(false);

// 添加状态用于控制是否使用优化布局
const useOptimizedLayout = ref(true);

// 滑块相关状态
const minValue = ref(0);
const maxValue = ref(100);
const valueRange = ref([0, 100]);
const allValues = ref([]);

// 动态计算滑块宽度
const sliderWidth = ref(240); // 默认宽度

// 根据容器宽度动态调整滑块宽度
const updateSliderWidth = () => {
  if (!chartContainer.value) return;
  
  const containerWidth = chartContainer.value.clientWidth;
  
  // 根据容器宽度动态调整
  if (containerWidth < 600) {
    sliderWidth.value = Math.max(containerWidth * 0.45, 150); // 小屏幕，最小宽度120px
  } else if (containerWidth < 1200) {
    sliderWidth.value = Math.max(containerWidth * 0.3, 180); // 中等屏幕
  } else if (containerWidth < 1600) {
    sliderWidth.value = Math.max(containerWidth * 0.25, 200); // 较大屏幕
  } else {
    sliderWidth.value = Math.max(containerWidth * 0.2, 240); // 大屏幕
  }
};

// 在 script setup 部分添加 sliderStep 计算
const sliderStep = computed(() => {
  if (!data.value || !data.value.length) return 0.1;
  const range = maxValue.value - minValue.value;
  // 确保小数位是一致的，避免因为精度问题导致的抖动
  return range <= 20 ? 0.1 : 1.0;
});

// 添加防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 防抖处理的滑块输入事件 - 实时更新颜色但不重绘图表
const handleRangeInput = debounce((newRange) => {
  if (!data.value.length || !chartContainer.value) return;
  
  // 只更新颜色而不重建整个图表
  updatePathColors();
}, 16); // 约60fps的更新率

// 处理滑块范围变化（完成拖动后触发）
const handleRangeChange = () => {
  if (!data.value.length || !chartContainer.value) return;
  
  // 范围最终确定后才重新渲染整个图表
  createConcentricDonuts(data.value, chartContainer.value);
};

// 更新路径颜色的函数，避免重新渲染整个图表
const updatePathColors = () => {
  if (!chartContainer.value) return;
  
  const svg = d3.select(chartContainer.value).select('svg');
  if (svg.empty()) return;
  
  // 获取当前选择的颜色
  let targetColor;
  if (datasetStore.getShowWeekday && datasetStore.getShowWeekend) {
    targetColor = THEME_COLOR;
  } else if (datasetStore.getShowWeekday) {
    targetColor = WEEKDAY_COLOR;
  } else if (datasetStore.getShowWeekend) {
    targetColor = WEEKEND_COLOR;
  } else {
    targetColor = THEME_COLOR;
  }
  
  // 使用同样的渐变色生成逻辑
  const gradientColors = generateGradientColors(targetColor, 10);
  
  // 创建颜色比例尺
  const colorScale = d3.scaleQuantize()
    .domain([valueRange.value[0], valueRange.value[1]])
    .range(gradientColors);
  
  // 更新所有路径的颜色
  svg.selectAll('path')
    .attr('fill', function() {
      const value = parseFloat(d3.select(this).attr('data-value'));
      if (value < valueRange.value[0]) {
        return gradientColors[0];
      } else if (value > valueRange.value[1]) {
        return gradientColors[gradientColors.length - 1];
      } else {
        return colorScale(value);
      }
    });
};

// 计算并更新滑块的范围值
const updateSliderRange = () => {
  if (data.value && data.value.length > 0) {
    // 提取所有数据点的值
    allValues.value = data.value.flatMap(user => user.res.map(item => item.value));
    
    // 计算最小值和最大值
    const min = Math.min(...allValues.value);
    const max = Math.max(...allValues.value);
    
    // 判断插值是否大于20
    if (max - min > 20) {
      minValue.value = Math.floor(min);
      maxValue.value = Math.ceil(max);
    } else {
      minValue.value = Math.floor(min * 10) / 10;
      maxValue.value = Math.ceil(max * 10) / 10;
    }
    
    // 设置初始范围为全范围
    valueRange.value = [minValue.value, maxValue.value];
  }
};

// 创建同心环形图
const createConcentricDonuts = (rawData, container) => {
  // 添加数据检查
  if (!rawData || !rawData.length) {
    console.warn('No data received');
    return;
  }
  
  // 使用优化布局算法重新排序数据
  const processedData = useOptimizedLayout.value ? optimizeRadialLayout(rawData) : rawData;
  
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
  const ringWidth = availableRadius / processedData.length; // 每个环的宽度

  // 为每个用户创建一个环
  processedData.forEach((user, index) => {
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
  updateSliderWidth(); // 更新滑块宽度
  if (data.value.length && chartContainer.value) {
    createConcentricDonuts(data.value, chartContainer.value);
  }
});

onMounted(() => {
  if (chartContainer.value) {
    updateSliderWidth(); // 初始化滑块宽度
    resizeObserver.observe(chartContainer.value);
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', updateSliderWidth);
});

onUnmounted(() => {
  if (chartContainer.value) {
    resizeObserver.unobserve(chartContainer.value);
  }
  
  // 移除窗口大小变化监听
  window.removeEventListener('resize', updateSliderWidth);
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

// 布局选项
const layoutOptions = [
  { label: 'Original', value: false },
  { label: 'Optimized', value: true }
];

// 切换布局方法
const switchLayout = (value) => {
  useOptimizedLayout.value = value;
  handleOptimizationToggle();
};

/**
 * 处理优化布局切换
 */
function handleOptimizationToggle() {
  // 当切换布局选项时，重新渲染视图
  if (data.value && data.value.length && chartContainer.value) {
    nextTick(() => {
      createConcentricDonuts(data.value, chartContainer.value);
    });
  }
}

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

.control-panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 10px;
}

.optimization-toggle {
  margin-left: 10px;
}
</style> 