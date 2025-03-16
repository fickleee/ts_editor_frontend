<template>
  <div ref="container" class="w-full h-full relative">
    <!-- 控制面板 -->
    <div class="absolute top-4 right-4 flex gap-4 z-10">
      <!-- 模型选择 -->
      <div class="relative">
        <select 
          v-model="selectedModel"
          class="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          @change="handleModelChange"
        >
          <option value="umap">UMAP</option>
          <option value="tsne">t-SNE</option>
          <option value="pca">PCA</option>
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>

      <!-- 聚合方式选择 -->
      <div class="relative">
        <select 
          v-model="selectedAggregation"
          class="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          @change="handleAggregationChange"
        >
          <option value="all">All</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
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
import { reqDataProjection } from '../api';

const container = ref(null);
const canvas = ref(null);
const svg = ref(null);
const tooltip = ref(null);
const datasetStore = useDatasetStore();

// 选择状态
const selectedModel = ref('tsne');
const selectedAggregation = ref('all');

// 存储所有的点数据
const allPoints = ref([]);
const transform = ref(d3.zoomIdentity);

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
  
  data.forEach(user => {
    user.trajectories.forEach(trajectory => {
      const trajectoryKey = `${user.id}-${trajectory.date}`;
      const trajectoryPoints = [];
      
      trajectory.points.forEach((point, index) => {
        const pointData = {
          x: point[0],
          y: point[1],
          userId: user.id,
          date: trajectory.date,
          timestamp: trajectory.timestamps[index]
        };
        points.push(pointData);
        trajectoryPoints.push(pointData);
      });
      
      // 按时间戳排序轨迹点
      trajectoryPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      trajectoryMap.set(trajectoryKey, trajectoryPoints);
    });
  });

  // 计算x和y的范围
  const xExtent = d3.extent(points, d => d.x);
  const yExtent = d3.extent(points, d => d.y);

  // 创建比例尺
  const xScale = d3.scaleLinear()
    .domain([xExtent[0], xExtent[1]])
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([yExtent[0], yExtent[1]])
    .range([height - margin.bottom, margin.top]);

  // 创建颜色比例尺（基于用户ID）
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

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

    // 首先绘制所有轨迹（低透明度）
    const userDayGroups = new Map();
    points.forEach(point => {
      const key = `${point.userId}-${point.date}`;
      if (!userDayGroups.has(key)) {
        userDayGroups.set(key, []);
      }
      userDayGroups.get(key).push(point);
    });

    // 绘制所有轨迹
    userDayGroups.forEach((dayPoints, key) => {
      // 按时间戳排序
      dayPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // 绘制连线
      ctx.beginPath();
      ctx.moveTo(xScale(dayPoints[0].x), yScale(dayPoints[0].y));
      for (let i = 1; i < dayPoints.length; i++) {
        ctx.lineTo(xScale(dayPoints[i].x), yScale(dayPoints[i].y));
      }
      ctx.strokeStyle = colorScale(dayPoints[0].userId);
      ctx.lineWidth = 1 / t.k;
      ctx.globalAlpha = 0.1; // 低透明度
      ctx.stroke();

      // 绘制轨迹点
      dayPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(xScale(point.x), yScale(point.y), 1 / t.k, 0, 2 * Math.PI);
        ctx.fillStyle = colorScale(point.userId);
        ctx.globalAlpha = 0.3;
        ctx.fill();
      });
    });

    // 重置透明度
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  // 缩放行为
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      transform.value = event.transform;
      draw();
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
    
    // 找到最近的点
    let nearestPoint = null;
    let minDistance = Infinity;
    
    points.forEach(point => {
      const dx = point.x - dataX;
      const dy = point.y - dataY;
      const distance = dx * dx + dy * dy;
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    });

    // 如果找到足够近的点，显示tooltip和高亮轨迹
    if (minDistance < 0.1) {
      // 重绘基本图形（包括所有低透明度轨迹）
      draw();
      
      // 找到同一天同一用户的所有点
      const dayPoints = points.filter(point => 
        point.userId === nearestPoint.userId && 
        point.date === nearestPoint.date
      );
      
      // 按时间戳排序
      dayPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // 绘制高亮轨迹
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);
      
      // 绘制高亮连线
      ctx.beginPath();
      ctx.moveTo(xScale(dayPoints[0].x), yScale(dayPoints[0].y));
      for (let i = 1; i < dayPoints.length; i++) {
        ctx.lineTo(xScale(dayPoints[i].x), yScale(dayPoints[i].y));
      }
      ctx.strokeStyle = colorScale(nearestPoint.userId);
      ctx.lineWidth = 2 / t.k;
      ctx.globalAlpha = 1;
      ctx.stroke();
      
      // 绘制高亮点
      dayPoints.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(xScale(point.x), yScale(point.y), 3 / t.k, 0, 2 * Math.PI);
        ctx.fillStyle = colorScale(nearestPoint.userId);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1 / t.k;
        ctx.stroke();
        
        // 在起点和终点添加时间标记
        if (index === 0 || index === dayPoints.length - 1) {
          ctx.fillStyle = 'black';
          ctx.font = `${12 / t.k}px Arial`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          const timeText = point.timestamp.split(' ')[1];
          ctx.fillText(timeText, 
            xScale(point.x) + 5 / t.k, 
            yScale(point.y) - 5 / t.k
          );
        }
      });
      
      ctx.restore();
      
      // 显示tooltip
      tooltip.value.style.display = 'block';
      tooltip.value.style.left = `${x + 10}px`;
      tooltip.value.style.top = `${y + 10}px`;
      tooltip.value.innerHTML = `User: ${nearestPoint.userId}<br>Date: ${nearestPoint.date}<br>Time: ${nearestPoint.timestamp.split(' ')[1]}`;
    } else {
      tooltip.value.style.display = 'none';
      // 重绘基本散点图
      draw();
    }
  };

  canvas.value.addEventListener('mousemove', handleMouseMove);
  
  // 初始绘制
  draw();

  // 清理函数
  return () => {
    canvas.value.removeEventListener('mousemove', handleMouseMove);
  };
};

// 处理模型变化
const handleModelChange = async () => {
  await fetchProjectionData();
};

// 处理聚合方式变化
const handleAggregationChange = async () => {
  await fetchProjectionData();
};

// 获取投影数据
const fetchProjectionData = async () => {
  if (!datasetStore.getCurrentDataset) {
    allPoints.value = [];
    return;
  }

  try {
    // 将模型和聚合方式作为参数传递给API
    const data = await reqDataProjection(
      datasetStore.getCurrentDataset,
      selectedModel.value,
      selectedAggregation.value
    );
    allPoints.value = data;
    createScatterPlot(data);
  } catch (error) {
    console.error('Error fetching projection data:', error);
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
});
</script>

<style scoped>
canvas {
  touch-action: none;
}
</style> 