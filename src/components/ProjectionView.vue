<template>
  <div ref="container" class="w-full h-full relative">
    <!-- 加载动画 -->
    <div v-if="isLoading" class="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
      <div class="flex flex-col items-center gap-2">
        <div class="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <span class="text-sm text-gray-600">loading...</span>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="absolute top-4 right-4 flex gap-4 z-10">
      <!-- 模型选择 -->
      <div class="relative">
        <button 
          @click="isModelOpen = !isModelOpen"
          class="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors duration-200"
        >
          <span class="text-sm font-medium">{{ selectedModel }}</span>
          <!-- 下拉箭头 -->
          <svg 
            class="h-4 w-4 transition-transform duration-200"
            :class="{ 'rotate-180': isModelOpen }"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
        <!-- 下拉菜单 -->
        <div 
          v-if="isModelOpen"
          class="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg py-1 z-20"
        >
          <button
            v-for="model in ['umap', 'tsne', 'pca']"
            :key="model"
            @click="() => {
              selectedModel = model;
              isModelOpen = false;
              handleModelChange();
            }"
            class="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-600"
            :class="{ 'bg-purple-50 text-purple-600': selectedModel === model }"
          >
            {{ model.toUpperCase() }}
          </button>
        </div>
      </div>

      <!-- 聚合方式选择 -->
      <div class="relative">
        <button 
          @click="isAggregationOpen = !isAggregationOpen"
          class="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors duration-200"
        >
          <span class="text-sm font-medium">{{ selectedAggregation }}</span>
          <!-- 下拉箭头 -->
          <svg 
            class="h-4 w-4 transition-transform duration-200"
            :class="{ 'rotate-180': isAggregationOpen }"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
        <!-- 下拉菜单 -->
        <div 
          v-if="isAggregationOpen"
          class="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg py-1 z-20"
        >
          <button
            v-for="option in ['all', 'day', 'week']"
            :key="option"
            @click="() => {
              selectedAggregation = option;
              isAggregationOpen = false;
              handleAggregationChange();
            }"
            class="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-600"
            :class="{ 'bg-purple-50 text-purple-600': selectedAggregation === option }"
          >
            {{ option.charAt(0).toUpperCase() + option.slice(1) }}
          </button>
        </div>
      </div>

      <!-- eps参数调整滑块 -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">eps:</span>
        <input 
          type="range" 
          v-model="epsValue" 
          min="0.5" 
          max="10" 
          step="0.5"
          class="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          @input="handleEpsChange"
        />
        <span class="text-sm text-gray-600 w-6 text-left">{{ epsValue }}</span>
      </div>
      
      <!-- 显示转移线开关 -->
      <!-- <div class="flex items-center">
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showTransitions" class="sr-only peer" @change="draw">
          <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          <span class="ml-2 text-sm font-medium text-gray-700">show arrows</span>
        </label>
      </div> -->
    </div>

    <canvas ref="canvas" class="absolute top-0 left-0"></canvas>
    <svg ref="svg" class="absolute top-0 left-0 pointer-events-none">
      <g class="axis-group"></g>
    </svg>
    <div ref="tooltip" class="absolute hidden bg-white p-2 rounded shadow-lg border text-sm"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { useDatasetStore } from '../stores/datasetStore';
import { reqDataCluster } from '../api';
import { useDebounceFn } from '@vueuse/core';

const container = ref(null);
const canvas = ref(null);
const svg = ref(null);
const tooltip = ref(null);
const datasetStore = useDatasetStore();

// 选择状态
const selectedModel = ref('tsne');
const selectedAggregation = ref('all');
const showTransitions = ref(true); // 控制是否显示转移线
const epsValue = ref(1.0); // 添加eps参数
const isModelOpen = ref(false);
const isAggregationOpen = ref(false);
const isLoading = ref(false);

// 存储所有的点数据
const allPoints = ref([]);
const transform = ref(d3.zoomIdentity);

// 用于存储当前绘制函数的引用
const currentDrawFunction = ref(null);

// 添加选中状态
const selectedClusterId = ref(null);

// 创建散点图
const createScatterPlot = (data) => {
  if (!data || !data.length) return;

  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const ctx = canvas.value.getContext('2d');

  // 设置 Canvas 和 SVG 尺寸
  canvas.value.width = width;
  canvas.value.height = height;
  canvas.value.style.width = `${width}px`;
  canvas.value.style.height = `${height}px`;
  
  d3.select(svg.value)
    .attr('width', width)
    .attr('height', height);

  // 提取所有点并按用户和日期组织数据
  const points = [];
  const trajectoryMap = new Map(); // 用于存储轨迹数据
  const clusterCenters = new Map(); // 存储所有簇的中心点
  const clusterCounts = new Map(); // 存储每个簇的点数量
  const transitionCounts = new Map(); // 存储簇之间的转移次数
  
  data.forEach(user => {
    // 处理全局聚类信息
    if (user.global_clustering && user.global_clustering.cluster_counts) {
      Object.entries(user.global_clustering.cluster_counts).forEach(([clusterId, count]) => {
        clusterCounts.set(clusterId, count);
      });
    }
    
    user.trajectories.forEach(trajectory => {
      const trajectoryKey = `${user.id}-${trajectory.date}`;
      const trajectoryPoints = [];
      
      // 处理轨迹点
      if (trajectory.points && trajectory.timestamps && trajectory.clusters) {
        // 计算簇之间的转移
        for (let i = 1; i < trajectory.points.length; i++) {
          const prevCluster = trajectory.clusters[i-1];
          const currCluster = trajectory.clusters[i];
          
          // 如果前后簇不同，记录一次转移
          if (prevCluster !== currCluster) {
            const transitionKey = `${prevCluster}-${currCluster}`;
            const count = transitionCounts.get(transitionKey) || 0;
            transitionCounts.set(transitionKey, count + 1);
          }
        }
        
        trajectory.points.forEach((point, index) => {
          const pointData = {
            x: point[0],
            y: point[1],
            userId: user.id,
            date: trajectory.date,
            timestamp: trajectory.timestamps[index],
            cluster: trajectory.clusters ? trajectory.clusters[index] : null
          };
          points.push(pointData);
          trajectoryPoints.push(pointData);
        });
      }
      
      // 处理簇中心点
      if (trajectory.cluster_centers) {
        Object.entries(trajectory.cluster_centers).forEach(([clusterId, center]) => {
          clusterCenters.set(clusterId, {
            x: center[0],
            y: center[1],
            clusterId: clusterId
          });
        });
      }
      
      // 按时间戳排序轨迹点
      trajectoryPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      trajectoryMap.set(trajectoryKey, trajectoryPoints);
    });
  });

  // 计算x和y的范围 (使用所有点而不仅仅是簇中心点，以保持一致的视图)
  const xExtent = d3.extent(points, d => d.x);
  const yExtent = d3.extent(points, d => d.y);

  // 创建比例尺
  const xScale = d3.scaleLinear()
    .domain([xExtent[0], xExtent[1]])
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([yExtent[0], yExtent[1]])
    .range([height - margin.bottom, margin.top]);

  // 创建颜色比例尺（基于簇ID）
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  
  // 创建大小比例尺（基于簇中的点数量）
  const maxCount = Math.max(...clusterCounts.values());
  const sizeScale = d3.scaleSqrt()
    .domain([1, maxCount])
    .range([3, 20]);
    
  // 创建线宽比例尺（基于转移次数）
  const maxTransitionCount = Math.max(...transitionCounts.values(), 1);
  const lineWidthScale = d3.scaleLinear()
    .domain([1, maxTransitionCount])
    .range([1, 8]);

  // 绘制轨迹线的函数
  const drawTrajectory = (userId, date) => {
    const trajectoryKey = `${userId}-${date}`;
    const trajectoryPoints = trajectoryMap.get(trajectoryKey);
    
    if (!trajectoryPoints || trajectoryPoints.length === 0) return;
    
    // 绘制轨迹线
    ctx.save();
    const t = transform.value;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);
    
    ctx.beginPath();
    ctx.moveTo(xScale(trajectoryPoints[0].x), yScale(trajectoryPoints[0].y));
    
    for (let i = 1; i < trajectoryPoints.length; i++) {
      ctx.lineTo(xScale(trajectoryPoints[i].x), yScale(trajectoryPoints[i].y));
    }
    
    ctx.strokeStyle = colorScale(userId);
    ctx.lineWidth = 2 / t.k; // 根据缩放调整线宽
    ctx.stroke();
    
    // 在轨迹点上绘制小圆点，标记时间顺序
    trajectoryPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(xScale(point.x), yScale(point.y), 2 / t.k, 0, 2 * Math.PI);
      ctx.fillStyle = colorScale(userId);
      ctx.fill();
      
      // 添加时间标记
      if (index === 0 || index === trajectoryPoints.length - 1) {
        ctx.fillStyle = 'black';
        ctx.font = `${12 / t.k}px Arial`;
        ctx.fillText(point.timestamp.split(' ')[1], 
          xScale(point.x) + 5 / t.k, 
          yScale(point.y) - 5 / t.k);
      }
    });
    
    ctx.restore();
  };

  // 基本绘制函数
  const draw = () => {
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 应用当前变换
    ctx.save();
    const t = transform.value;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // 绘制簇中心点
    clusterCenters.forEach((center, clusterId) => {
      const count = clusterCounts.get(clusterId) || 1;
      const radius = sizeScale(count) / t.k;
      
      ctx.beginPath();
      ctx.arc(xScale(center.x), yScale(center.y), radius, 0, 2 * Math.PI);
      ctx.fillStyle = colorScale(clusterId);
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1 / t.k;
      ctx.stroke();
    });

    // 如果启用了转移线显示，绘制转移线
    if (showTransitions.value) {
      // 绘制簇之间的转移线
      transitionCounts.forEach((count, transitionKey) => {
        const [sourceId, targetId] = transitionKey.split('-');
        const source = clusterCenters.get(sourceId);
        const target = clusterCenters.get(targetId);
        
        if (source && target) {
          // 计算线宽
          const lineWidth = lineWidthScale(count) / t.k;
          
          // 绘制从源到目标的箭头线
          const startX = xScale(source.x);
          const startY = yScale(source.y);
          const endX = xScale(target.x);
          const endY = yScale(target.y);
          
          // 计算方向向量
          const dx = endX - startX;
          const dy = endY - startY;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          // 如果源和目标是同一个点，不绘制
          if (length < 0.001) return;
          
          // 单位向量
          const unitX = dx / length;
          const unitY = dy / length;
          
          // 计算源和目标簇的半径
          const sourceRadius = sizeScale(clusterCounts.get(sourceId) || 1) / t.k;
          const targetRadius = sizeScale(clusterCounts.get(targetId) || 1) / t.k;
          
          // 调整起点和终点，使线条从簇边缘开始和结束
          const adjustedStartX = startX + unitX * sourceRadius;
          const adjustedStartY = startY + unitY * sourceRadius;
          const adjustedEndX = endX - unitX * targetRadius;
          const adjustedEndY = endY - unitY * targetRadius;
          
          // 绘制线条
          ctx.beginPath();
          ctx.moveTo(adjustedStartX, adjustedStartY);
          ctx.lineTo(adjustedEndX, adjustedEndY);
          
          // 设置线条样式
          ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
          ctx.lineWidth = lineWidth;
          ctx.stroke();
          
          // 绘制箭头
          const arrowSize = Math.min(8, lineWidth * 3) / t.k;
          const angle = Math.atan2(dy, dx);
          
          ctx.beginPath();
          ctx.moveTo(adjustedEndX, adjustedEndY);
          ctx.lineTo(
            adjustedEndX - arrowSize * Math.cos(angle - Math.PI / 6),
            adjustedEndY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            adjustedEndX - arrowSize * Math.cos(angle + Math.PI / 6),
            adjustedEndY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
          ctx.fill();
        }
      });
    }

    // 如果有选中的簇，显示该簇的所有点
    if (selectedClusterId.value !== null) {
      // 从allPoints中查找属于选中簇的点
      allPoints.value.forEach(user => {
        user.trajectories.forEach(trajectory => {
          if (trajectory.points && trajectory.timestamps && trajectory.clusters) {
            trajectory.points.forEach((point, index) => {
              if (trajectory.clusters[index] == selectedClusterId.value) {
                ctx.beginPath();
                ctx.arc(xScale(point[0]), yScale(point[1]), 2 / t.k, 0, 2 * Math.PI);
                ctx.fillStyle = colorScale(user.id);
                ctx.globalAlpha = 0.8; // 增加透明度使点更明显
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 0.5 / t.k;
                ctx.stroke();
              }
            });
          }
        });
      });
    }

    // 重置透明度
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  // 保存当前绘制函数的引用，以便在其他地方调用
  currentDrawFunction.value = draw;

  // 缩放行为
  const zoom = d3.zoom()
    .scaleExtent([0.1, 15])
    .on('zoom', (event) => {
      transform.value = event.transform;
      if (currentDrawFunction.value) {
        currentDrawFunction.value();
      }
    });

  // 应用缩放行为到 Canvas
  d3.select(canvas.value).call(zoom);

  // 处理鼠标移动
  const handleMouseMove = (event) => {
    const rect = canvas.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 转换鼠标坐标到数据空间
    const t = transform.value;
    const dataX = xScale.invert((x - t.x) / t.k);
    const dataY = yScale.invert((y - t.y) / t.k);
    
    // 找到最近的簇中心点
    let nearestCenter = null;
    let minDistance = Infinity;
    
    clusterCenters.forEach((center, clusterId) => {
      const dx = center.x - dataX;
      const dy = center.y - dataY;
      const distance = dx * dx + dy * dy;
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestCenter = { ...center, clusterId };
      }
    });

    // 如果找到足够近的簇中心点，高亮显示
    const threshold = 0.1 * (sizeScale(clusterCounts.get(nearestCenter?.clusterId) || 1) / t.k);
    if (nearestCenter && minDistance < threshold) {
      // 重绘基本图形
      if (currentDrawFunction.value) {
        currentDrawFunction.value();
      }
      
      // 高亮显示选中的簇
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);
      
      const count = clusterCounts.get(nearestCenter.clusterId) || 1;
      const radius = sizeScale(count) / t.k;
      
      // 绘制高亮边框
      ctx.beginPath();
      ctx.arc(xScale(nearestCenter.x), yScale(nearestCenter.y), radius + 2 / t.k, 0, 2 * Math.PI);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2 / t.k;
      ctx.stroke();
      
      // 显示簇ID
      ctx.fillStyle = 'white';
      ctx.font = `${Math.min(12, radius * t.k)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nearestCenter.clusterId, xScale(nearestCenter.x), yScale(nearestCenter.y));
      
      // 从allPoints中查找并显示属于该簇的点
      allPoints.value.forEach(user => {
        user.trajectories.forEach(trajectory => {
          if (trajectory.points && trajectory.timestamps && trajectory.clusters) {
            trajectory.points.forEach((point, index) => {
              if (trajectory.clusters[index] == nearestCenter.clusterId) {
                ctx.beginPath();
                ctx.arc(xScale(point[0]), yScale(point[1]), 2 / t.k, 0, 2 * Math.PI);
                ctx.fillStyle = colorScale(user.id);
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 0.5 / t.k;
                ctx.stroke();
              }
            });
          }
        });
      });
      
      ctx.restore();
    } else {
      // 重绘基本散点图
      if (currentDrawFunction.value) {
        currentDrawFunction.value();
      }
    }
  };

  // 添加点击事件处理
  const handleClick = (event) => {
    const rect = canvas.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 转换鼠标坐标到数据空间
    const t = transform.value;
    const dataX = xScale.invert((x - t.x) / t.k);
    const dataY = yScale.invert((y - t.y) / t.k);
    
    // 找到最近的簇中心点
    let nearestCenter = null;
    let minDistance = Infinity;
    
    clusterCenters.forEach((center, clusterId) => {
      const dx = center.x - dataX;
      const dy = center.y - dataY;
      const distance = dx * dx + dy * dy;
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestCenter = { ...center, clusterId };
      }
    });

    // 如果找到足够近的簇中心点，更新选中状态
    const threshold = 0.1 * (sizeScale(clusterCounts.get(nearestCenter?.clusterId) || 1) / t.k);
    if (nearestCenter && minDistance < threshold) {
      // 如果点击的是当前选中的簇，取消选中
      if (selectedClusterId.value === nearestCenter.clusterId) {
        selectedClusterId.value = null;
      } else {
        selectedClusterId.value = nearestCenter.clusterId;
      }
      // 重绘图表
      if (currentDrawFunction.value) {
        currentDrawFunction.value();
      }
    }
  };

  canvas.value.addEventListener('mousemove', handleMouseMove);
  canvas.value.addEventListener('click', handleClick);
  
  // 初始绘制
  draw();

  // 清理函数
  return () => {
    canvas.value.removeEventListener('mousemove', handleMouseMove);
    canvas.value.removeEventListener('click', handleClick);
  };
};

// 处理模型变化
const handleModelChange = () => {
  // 移除这里的fetchProjectionData调用，让watch来处理
};

// 处理聚合方式变化
const handleAggregationChange = () => {
  // 移除这里的fetchProjectionData调用，让watch来处理
};

// 处理eps参数变化（添加防抖）
const handleEpsChange = useDebounceFn(async () => {
  await fetchProjectionData();
}, 500); // 500ms的防抖延迟

// 暴露给组件的绘制函数
const draw = () => {
  if (currentDrawFunction.value) {
    currentDrawFunction.value();
  }
};

// 获取投影数据
const fetchProjectionData = async () => {
  if (!datasetStore.getCurrentDataset) {
    allPoints.value = [];
    return;
  }

  try {
    isLoading.value = true;
    // 将模型、聚合方式和eps参数作为参数传递给API
    const data = await reqDataCluster(
      datasetStore.getCurrentDataset,
      selectedModel.value,
      selectedAggregation.value,
      epsValue.value
    );
    allPoints.value = data;
    createScatterPlot(data);
  } catch (error) {
    console.error('Error fetching projection data:', error);
  } finally {
    isLoading.value = false;
  }
};

// 监听窗口大小变化
const resizeObserver = new ResizeObserver(() => {
  if (allPoints.value.length && container.value) {
    createScatterPlot(allPoints.value);
  }
});

onMounted(() => {
  if (container.value) {
    resizeObserver.observe(container.value);
  }
});

onUnmounted(() => {
  if (container.value) {
    resizeObserver.unobserve(container.value);
  }
});

// 监听数据集变化
watch(() => datasetStore.getCurrentDataset, (newDataset) => {
  // TODO: 暂时不支持capture数据集的投影视图
  if (newDataset === 'capture') {
    return;
  }
  if (newDataset) {
    fetchProjectionData();
  } else {
    allPoints.value = [];
  }
}, { immediate: true });

// 监听选择变化
watch([selectedModel, selectedAggregation], () => {
  if (datasetStore.getCurrentDataset) {
    fetchProjectionData();
  }
}, { immediate: true });
</script>

<style scoped>
canvas {
  touch-action: none;
}
</style> 