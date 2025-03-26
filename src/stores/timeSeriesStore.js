import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as d3 from 'd3'
import { generateHouseData } from '../utils/generateData'
import { ElMessage } from 'element-plus'
import { useDatasetStore } from './datasetStore'

export const useTimeSeriesStore = defineStore('timeSeries', () => {
  const series = ref([])
  const operations = ref([])
  const operationIndex = ref(-1)
  const maxOperations = 100

  const selectedTimeRange = ref(null)
  const selectedSeries = ref([])
  const previewSeries = ref(null)

  const viewport = ref({
    start: 0,
    end: 24
  });

  const editedSeriesData = ref([]);

  const clearAllData = () => {
    series.value = [];
    operations.value = [];
    operationIndex.value = -1;
    selectedTimeRange.value = null;
    selectedSeries.value = [];
    previewSeries.value = null;
    
    // 清除本地存储，如果有的话
    localStorage.removeItem('timeSeriesData');
  }

  const initializeData = () => {
    // 确保没有默认曲线
    clearAllData();
  }

  const addSeries = (newSeries) => {
    const existingSeries = series.value.find(s => s.id === newSeries.id);
    if (!existingSeries) {
      series.value.push(newSeries);
    } else {
      Object.assign(existingSeries, newSeries);
    }
    saveState()
  }

  const saveState = () => {
    series.value.forEach(s => {
      if (s.data.length !== 1440) {
        console.warn(`Series ${s.id} has ${s.data.length} points, fixing...`);
        s.data = ensureDataPoints(s.data);
      }
    });
    
    if (operationIndex.value < operations.value.length - 1) {
      operations.value = operations.value.slice(0, operationIndex.value + 1)
    }
    operations.value.push({
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type: 'save',
      seriesIds: series.value.map(s => s.id),
      timeRange: selectedTimeRange.value ? { ...selectedTimeRange.value } : null,
      params: {},
      beforeData: null,
      afterData: JSON.parse(JSON.stringify(series.value))
    })
    if (operations.value.length > maxOperations) {
      operations.value.shift()
    }
    operationIndex.value = operations.value.length - 1
  }

  const setSelection = (timeRange, seriesIds) => {
    selectedTimeRange.value = timeRange
    selectedSeries.value = seriesIds
  }

  const clearSelection = () => {
    selectedTimeRange.value = null
    selectedSeries.value = []
  }

  const setPreviewSeries = (pattern) => {
    if (!pattern || !selectedTimeRange.value) {
      previewSeries.value = null
      return
    }

    const { start, end } = selectedTimeRange.value
    const duration = end - start

    const previewData = pattern.data.map(point => {
      const normalizedTime = (point.time - pattern.start) / (pattern.end - pattern.start)
      const newTime = start + normalizedTime * duration
      return {
        time: newTime,
        value: point.value
      }
    }).sort((a, b) => a.time - b.time)

    previewSeries.value = {
      id: 'preview',
      data: previewData,
      type: 'preview',
      visible: true
    }
  }

  const clearPreviewSeries = () => {
    previewSeries.value = null
  }

  const moveSeries = (seriesId, offset) => {
    if (!selectedTimeRange.value) return

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    const beforeData = getSeriesSnapshot([seriesId])
    
    const operationType = offset.x !== 0 && offset.y === 0 ? 'move-x' : 
                         offset.x === 0 && offset.y !== 0 ? 'move-y' : 'move-xy'

    const currentSeries = series.value[seriesIndex]
    const { start, end } = selectedTimeRange.value

    const hasChildren = series.value.some(s => s.parentId === seriesId)

    if (currentSeries.parentId) {
      const parentIndex = series.value.findIndex(s => s.id === currentSeries.parentId)
      if (parentIndex !== -1) {
        const childSeries = series.value.filter(s => s.parentId === currentSeries.parentId)
        
        const newParentData = JSON.parse(JSON.stringify(series.value[parentIndex].data))
        
        const newData = JSON.parse(JSON.stringify(currentSeries.data))
        
        newData.forEach((point, i) => {
          if (point && point.time >= start && point.time <= end) {
            newData[i] = {
              time: point.time + offset.x,
              value: Math.max(0, Math.min(15000, point.value + offset.y))
            }
          }
        })
        
        newParentData.forEach((point, i) => {
          if (point) {
            point.value = 0;
            childSeries.forEach(child => {
              const childData = child.id === seriesId ? newData : child.data;
              if (childData[i] && childData[i].time === point.time) {
                point.value += childData[i].value;
              }
            });
          }
        })
        
        series.value[seriesIndex] = {
          ...currentSeries,
          data: newData
        }
        
        series.value[parentIndex] = {
          ...series.value[parentIndex],
          data: newParentData
        }
      }
    } else {
      if (hasChildren) {
        ElMessage.warning('Warning: Modifying the parent series will break consistency with child series')
      }
      
      const newData = JSON.parse(JSON.stringify(currentSeries.data))
      
      newData.forEach((point, i) => {
        if (point && point.time >= start && point.time <= end) {
          newData[i] = {
            time: point.time + offset.x,
            value: Math.max(0, Math.min(15000, point.value + offset.y))
          }
        }
      })
      
      newData.sort((a, b) => a.time - b.time)
      
      series.value[seriesIndex] = {
        ...currentSeries,
        data: newData
      }
    }

    series.value[seriesIndex].data = ensureDataPoints(series.value[seriesIndex].data);
    
    const afterData = getSeriesSnapshot([seriesId])
    recordOperation(operationType, seriesId, { offset }, beforeData, afterData);
  }

  const applyCurve = (seriesId, curve) => {
    if (!selectedTimeRange.value) return

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    const beforeData = getSeriesSnapshot([seriesId])

    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))
    const { start, end } = selectedTimeRange.value
    const duration = end - start

    newData.forEach((point, i) => {
      if (point.time >= start && point.time <= end) {
        const relativePosition = (point.time - start) / duration
        
        const multiplier = interpolateCurveAtPosition(curve, relativePosition)
        
        newData[i] = {
          time: point.time,
          value: point.value * multiplier
        }
      }
    })

    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }

    series.value[seriesIndex].data = ensureDataPoints(series.value[seriesIndex].data);
    
    const afterData = getSeriesSnapshot([seriesId])
    recordOperation('curve', seriesId, { curve }, beforeData, afterData);
  }

  const interpolateCurveAtPosition = (curve, position) => {
    position = Math.max(0, Math.min(1, position))
    
    let leftIndex = 0
    let rightIndex = curve.length - 1
    
    for (let i = 0; i < curve.length - 1; i++) {
      if (curve[i].x <= position && curve[i + 1].x >= position) {
        leftIndex = i
        rightIndex = i + 1
        break
      }
    }
    
    if (curve[leftIndex].x === position) return curve[leftIndex].y
    if (curve[rightIndex].x === position) return curve[rightIndex].y
    
    const t = (position - curve[leftIndex].x) / (curve[rightIndex].x - curve[leftIndex].x)
    return curve[leftIndex].y + t * (curve[rightIndex].y - curve[leftIndex].y)
  }

  const expandTimeSeries = (selections) => {
    if (!selections || selections.length === 0) return;
    
    const beforeData = getSeriesSnapshot(selectedSeries.value);
    
    const totalSelectedTime = selections.reduce((sum, sel) => sum + (sel.end - sel.start), 0);
    const scaleFactor = 24 / totalSelectedTime;
    
    selectedSeries.value.forEach(id => {
      const seriesIndex = series.value.findIndex(s => s.id === id);
      if (seriesIndex === -1) return;
      
      const originalData = series.value[seriesIndex].data;
      const newData = new Array(1440);
      
      for (let i = 0; i < 1440; i++) {
        const hour = i / 60;
        newData[i] = {
          time: parseFloat(hour.toFixed(2)),
          value: null
        };
      }
      
      let currentTime = 0;
      
      const interpolate = (time, p1, p2) => {
        const t = (time - p1.time) / (p2.time - p1.time);
        return p1.value + t * (p2.value - p1.value);
      };
      
      const getValueAtTime = (time, data) => {
        const points = data.filter(p => p && !isNaN(p.time) && !isNaN(p.value));
        if (points.length === 0) return null;
        if (points.length === 1) return points[0].value;
        
        const i = points.findIndex(p => p.time > time);
        if (i === 0) return points[0].value;
        if (i === -1) return points[points.length - 1].value;
        
        return interpolate(time, points[i - 1], points[i]);
      };
      
      selections.forEach((selection, index) => {
        const segmentData = originalData.filter(
          point => point && !isNaN(point.time) && !isNaN(point.value) &&
                  point.time >= selection.start && point.time <= selection.end
        );
        
        if (segmentData.length === 0) return;
        
        const segmentDuration = (selection.end - selection.start) * scaleFactor;
        const segmentEndTime = currentTime + segmentDuration;
        
        for (let minute = Math.floor(currentTime * 60); minute < Math.floor(segmentEndTime * 60); minute++) {
          if (minute >= 1440) break;
          
          const progress = (minute / 60 - currentTime) / segmentDuration;
          const originalTime = selection.start + progress * (selection.end - selection.start);
          
          const value = getValueAtTime(originalTime, segmentData);
          
          if (value !== null) {
            newData[minute] = {
              time: minute / 60,
              value: parseFloat(value.toFixed(8))
            };
          }
        }
        
        currentTime = segmentEndTime;
      });
      
      for (let i = 0; i < 1440; i++) {
        if (newData[i].value === null) {
          let prevValue = null;
          let nextValue = null;
          
          for (let j = i - 1; j >= 0; j--) {
            if (newData[j].value !== null) {
              prevValue = newData[j].value;
              break;
            }
          }
          
          for (let j = i + 1; j < 1440; j++) {
            if (newData[j].value !== null) {
              nextValue = newData[j].value;
              break;
            }
          }
          
          if (prevValue !== null && nextValue !== null) {
            newData[i].value = parseFloat(((prevValue + nextValue) / 2).toFixed(8));
          } else if (prevValue !== null) {
            newData[i].value = prevValue;
          } else if (nextValue !== null) {
            newData[i].value = nextValue;
          } else {
            newData[i].value = originalData[0]?.value || 0;
          }
        }
      }
      
      series.value[seriesIndex] = {
        ...series.value[seriesIndex],
        data: newData
      };
    });
    
    const afterData = getSeriesSnapshot(selectedSeries.value);
    
    recordOperation('expand', selectedSeries.value, { selections }, beforeData, afterData);
    
    clearSelection();
  }

  const findSimilarPatterns = (seriesId) => {
    if (!selectedTimeRange.value || !seriesId) return []
    
    const datasetStore = useDatasetStore()
    const originalDataset = datasetStore.getOriginalData
    
    console.log('开始寻找相似模式, 数据集大小:', originalDataset ? originalDataset.length : 0);
    
    // 以下是处理当前选中序列的逻辑
    const patterns = []
    
    const sourceSeries = series.value.find(s => s.id === seriesId)
    if (!sourceSeries) return []
    
    const { start, end } = selectedTimeRange.value
    const duration = end - start
    
    // 提取目标模式的边界值用于相似度匹配
    const leftValue = interpolateValue(sourceSeries.data, start)
    const rightValue = interpolateValue(sourceSeries.data, end)
    
    // 计算在选定范围内的模式能量
    const selectedData = sourceSeries.data.filter(p => 
      p && p.time !== null && p.time !== undefined && 
      p.value !== null && p.value !== undefined && 
      !isNaN(p.time) && !isNaN(p.value) && 
      p.time >= start && p.time <= end
    )
    
    console.log('源模式: 时间范围=' + start.toFixed(2) + '-' + end.toFixed(2) + ', 边界值: 左=' + leftValue.toFixed(2) + ', 右=' + rightValue.toFixed(2));
    
    // 从数据集中搜索相似模式
    const maxPossibleDiff = 200 // 可能的最大差异值
    
    // 只在数据集中搜索，不在编辑视图中搜索
    if (originalDataset && originalDataset.length > 0) {
      // 跟踪匹配的日期分布
      const matchedDateDistribution = {}
      
      // 对于每个用户，处理其数据
      for (const userData of originalDataset) {
        if (!userData || !userData.data || !userData.id) continue
        
        // 按日期分组数据
        const dataByDate = {}
        
        // 第一次遍历：将数据按日期分组
        for (const point of userData.data) {
          if (!point.time || !point.value) continue
          
          let dateStr = '未知';
          let timeValue = 0;
          
          // 提取日期和转换时间
          if (typeof point.time === 'string' && point.time.includes('-') && point.time.includes(' ')) {
            const parts = point.time.split(' ');
            dateStr = parts[0]; // 日期部分: YYYY-MM-DD
            const timePart = parts[1]; // 时间部分: HH:MM:SS
            
            if (timePart) {
              const timeParts = timePart.split(':').map(Number);
              if (timeParts.length >= 2) {
                timeValue = timeParts[0] + (timeParts[1] / 60) + ((timeParts.length > 2 ? timeParts[2] : 0) / 3600);
              }
            }
          } else if (typeof point.time === 'string') {
            // 如果只有时间部分，没有日期
            const parts = point.time.split(':').map(Number);
            if (parts.length >= 2) {
              timeValue = parts[0] + (parts[1] / 60) + ((parts.length > 2 ? parts[2] : 0) / 3600);
            }
          } else if (typeof point.time === 'number') {
            timeValue = point.time;
          }
          
          // 只添加有效数据点
          if (!isNaN(timeValue) && !isNaN(point.value)) {
            if (!dataByDate[dateStr]) {
              dataByDate[dateStr] = [];
            }
            
            dataByDate[dateStr].push({
              time: timeValue,
              value: point.value,
              originalTime: point.time
            });
          }
        }
        
        // 第二次遍历：处理每个日期的数据
        for (const [dateStr, dateData] of Object.entries(dataByDate)) {
          // 跳过太少数据点的日期
          if (dateData.length < 100) continue;
          
          // 排序数据
          dateData.sort((a, b) => a.time - b.time);
          
          console.log(`处理用户${userData.id}的${dateStr}数据: ${dateData.length}个点, 范围${dateData[0].time.toFixed(2)}-${dateData[dateData.length-1].time.toFixed(2)}`);
          
          // 对每个日期的数据进行模式匹配
          const datasetStep = Math.max(1, Math.floor(dateData.length / 200));
          
          // 预计算窗口左边界值
          const windowLeftValues = [];
          for (let i = 0; i < dateData.length; i += datasetStep) {
            const point = dateData[i];
            if (!point) continue;
            
            const windowStart = point.time;
            windowLeftValues.push({
              index: i,
              time: windowStart,
              leftValue: interpolateValue(dateData, windowStart)
            });
          }
          
          // 按左边界值相似度排序
          windowLeftValues.sort((a, b) => {
            const aDiff = Math.abs(leftValue - a.leftValue);
            const bDiff = Math.abs(leftValue - b.leftValue);
            return aDiff - bDiff;
          });
          
          // 只处理相似度最高的前50%窗口
          const topWindowsCount = Math.ceil(windowLeftValues.length * 0.5);
          const topWindows = windowLeftValues.slice(0, topWindowsCount);
          
          for (const window of topWindows) {
            const windowStart = window.time;
            const windowEnd = windowStart + duration;
            
            if (windowEnd > 24) continue;
            
            // 避免匹配过近区域
            if (sourceSeries.id && sourceSeries.id.includes(`user_${userData.id}`) && 
                Math.abs(windowStart - start) < duration * 0.3) {
              continue;
            }
            
            // 使用预计算的左边界值
            const windowLeftValue = window.leftValue;
            const leftDiff = Math.abs(leftValue - windowLeftValue);
            const leftSimilarity = 1 - Math.min(leftDiff / maxPossibleDiff, 1);
            
            // 左边界相似度阈值过滤
            if (leftSimilarity < 0.6) continue;
            
            // 计算右边界值和整体相似度
            const windowRightValue = interpolateValue(dateData, windowEnd);
            const rightDiff = Math.abs(rightValue - windowRightValue);
            const rightSimilarity = 1 - Math.min(rightDiff / maxPossibleDiff, 1);
            
            const similarity = (leftSimilarity + rightSimilarity) / 2;
            
            if (similarity <= 0.7) continue;
            
            // 提取窗口数据
            const windowData = dateData.filter(p => 
              p && p.time >= windowStart && p.time <= windowEnd
            );
            
            const patternEnergy = calculatePatternEnergy(windowData);
            
            // 使用日期作为模式标识的一部分
            const displayName = `user ${userData.id} (${dateStr})`;
            
            patterns.push({
              seriesId: `dataset_user_${userData.id}_${dateStr}`,
              start: windowStart,
              end: windowEnd,
              data: windowData,
              similarity,
              leftValue: windowLeftValue,
              rightValue: windowRightValue,
              color: getColorForEnergy(patternEnergy),
              sourceName: displayName,
              sourceType: 'dataset',
              userId: userData.id,
              date: dateStr
            });
            
            // 更新日期分布统计
            matchedDateDistribution[dateStr] = (matchedDateDistribution[dateStr] || 0) + 1;
          }
        }
      }
      
      console.log('处理用户数:', Object.keys(matchedDateDistribution).length);
      console.log('匹配模式日期分布:', matchedDateDistribution);
    }

    // 排序并返回结果
    console.log(`共找到 ${patterns.length} 个匹配模式`);
    patterns.sort((a, b) => b.similarity - a.similarity);
    
    // 只返回来自数据集的匹配模式
    return patterns.filter(pattern => pattern.sourceType === 'dataset').slice(0, 10);
  }

  const interpolateValue = (data, time) => {
    const validData = data.filter(p => 
      p && p.time !== null && p.time !== undefined && 
      p.value !== null && p.value !== undefined && 
      !isNaN(p.time) && !isNaN(p.value)
    )
    
    if (validData.length === 0) return 0
    
    const points = validData.filter(p => p.time <= time).sort((a, b) => b.time - a.time)
    const nextPoints = validData.filter(p => p.time > time).sort((a, b) => a.time - b.time)

    if (points.length === 0) return nextPoints[0]?.value ?? 0
    if (nextPoints.length === 0) return points[0]?.value ?? 0

    const prev = points[0]
    const next = nextPoints[0]
    
    if (Math.abs(next.time - prev.time) < 0.0001) return prev.value
    
    const t = (time - prev.time) / (next.time - prev.time)
    return prev.value + t * (next.value - prev.value)
  }

  const replaceWithPattern = (pattern, seriesId) => {
    if (!selectedTimeRange.value || !seriesId) return

    const beforeData = getSeriesSnapshot([seriesId])

    const { start, end } = selectedTimeRange.value
    const duration = end - start

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))
    
    const leftValue = interpolateValue(newData, start)
    const rightValue = interpolateValue(newData, end)
    
    const patternData = pattern.data.filter(p => 
      p && p.time !== null && p.time !== undefined && 
      p.value !== null && p.value !== undefined && 
      !isNaN(p.time) && !isNaN(p.value)
    )
    
    if (patternData.length < 2) return
    
    // Remove existing points in the selection range
    for (let i = newData.length - 1; i >= 0; i--) {
      const point = newData[i]
      if (point && !isNaN(point.time) && point.time >= start && point.time <= end) {
        newData.splice(i, 1)
      }
    }
    
    // Add new points from the pattern, with appropriate time mapping
    const replacementPoints = [];
    patternData.forEach(point => {
      const normalizedTime = (point.time - pattern.start) / (pattern.end - pattern.start)
      const newTime = start + normalizedTime * duration
      
      let adjustedValue = point.value
      
      // Smooth transition at boundaries (first and last 10% of the range)
      if (normalizedTime < 0.1) {
        const blendFactor = normalizedTime / 0.1
        adjustedValue = leftValue * (1 - blendFactor) + point.value * blendFactor
      } else if (normalizedTime > 0.9) {
        const blendFactor = (normalizedTime - 0.9) / 0.1
        adjustedValue = point.value * (1 - blendFactor) + rightValue * blendFactor
      }
      
      replacementPoints.push({
        time: newTime,
        value: adjustedValue
      })
    })
    
    // 线性插值确保每分钟都有数据点
    const interpolatedPoints = ensureMinuteGranularity(replacementPoints, start, end);
    
    // 在添加到newData前确保没有时间相近的点
    // 优先保留来自插值的点，因为它们是按分钟对齐的
    interpolatedPoints.forEach(point => {
      // 检查是否已经存在时间非常接近的点
      const existingPointIndex = newData.findIndex(p => 
        Math.abs(p.time - point.time) < 0.001 // 约3.6秒的阈值
      );
      
      if (existingPointIndex === -1) {
        // 如果不存在相近的点，直接添加
        newData.push(point);
      } else {
        // 如果存在相近的点，替换它
        // 注意：我们更新时间以确保对齐到整分钟
        newData[existingPointIndex].time = point.time;
        newData[existingPointIndex].value = point.value;
      }
    });
    
    // Sort data points by time
    newData.sort((a, b) => a.time - b.time);
    
    // Add transition zones beyond the selection range
    const transitionRange = 0.5
    const startTransition = Math.max(0, start - transitionRange)
    const endTransition = Math.min(24, end + transitionRange)
    
    // Apply easing to transition zones
    for (let i = 0; i < newData.length; i++) {
      const point = newData[i]
      if (!point || isNaN(point.time) || isNaN(point.value)) continue
      
      // Pre-selection transition
      if (point.time >= startTransition && point.time < start) {
        const progress = (point.time - startTransition) / transitionRange
        const easeProgress = d3.easeCubicInOut(progress)
        
        const originalValue = point.value
        const nextPoint = newData.find(p => p && !isNaN(p.time) && !isNaN(p.value) && p.time >= start)
        if (nextPoint) {
          newData[i].value = originalValue * (1 - easeProgress) + nextPoint.value * easeProgress
        }
      } 
      // Post-selection transition
      else if (point.time > end && point.time <= endTransition) {
        const progress = (point.time - end) / transitionRange
        const easeProgress = d3.easeCubicInOut(progress)
        
        const originalValue = point.value
        const prevPoints = newData.filter(p => p && !isNaN(p.time) && !isNaN(p.value) && p.time <= end)
        const prevPoint = prevPoints.length > 0 ? prevPoints[prevPoints.length - 1] : null
        
        if (prevPoint) {
          newData[i].value = prevPoint.value * (1 - easeProgress) + originalValue * easeProgress
        }
      }
    }
    
    // Update the series with new data
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }
    
    // Record the operation for undo/redo
    const afterData = getSeriesSnapshot([seriesId])
    recordOperation('replace', seriesId, { 
      pattern: {
        seriesId: pattern.seriesId,
        start: pattern.start,
        end: pattern.end,
        userId: pattern.userId,
        date: pattern.date
      }
    }, beforeData, afterData)
  }

  // 添加这个新函数来确保每分钟都有数据点
  const ensureMinuteGranularity = (points, start, end) => {
    if (points.length < 2) return points;
    
    // 先按时间排序
    points.sort((a, b) => a.time - b.time);
    
    const result = [];
    // 转换小时为分钟，并计算需要的分钟点
    const startMinutes = Math.floor(start * 60);
    const endMinutes = Math.ceil(end * 60);
    
    // 为每一分钟创建一个数据点
    for (let minuteIndex = startMinutes; minuteIndex <= endMinutes; minuteIndex++) {
      const currentTime = minuteIndex / 60; // 转回小时表示
      
      // 如果在已有点附近(±0.001小时，约3.6秒)，使用已有点
      const existingPoint = points.find(p => Math.abs(p.time - currentTime) < 0.001);
      if (existingPoint) {
        result.push({
          time: currentTime, // 使用精确的分钟时间
          value: existingPoint.value
        });
        continue;
      }
      
      // 找到当前时间点的左右边界点进行插值
      const lowerIndex = points.findIndex(p => p.time > currentTime) - 1;
      
      // 边界情况处理
      if (lowerIndex < 0) {
        // 在第一个点之前，使用第一个点的值
        result.push({
          time: currentTime,
          value: points[0].value
        });
      } else if (lowerIndex >= points.length - 1) {
        // 在最后一个点之后，使用最后一个点的值
        result.push({
          time: currentTime,
          value: points[points.length - 1].value
        });
      } else {
        // 正常情况，进行线性插值
        const lowerPoint = points[lowerIndex];
        const upperPoint = points[lowerIndex + 1];
        
        // 计算权重
        const totalInterval = upperPoint.time - lowerPoint.time;
        if (totalInterval <= 0) {
          // 如果两点时间相同，使用其中一个的值
          result.push({
            time: currentTime,
            value: lowerPoint.value
          });
        } else {
          const weight = (currentTime - lowerPoint.time) / totalInterval;
          // 线性插值计算值
          const interpolatedValue = lowerPoint.value + weight * (upperPoint.value - lowerPoint.value);
          
          result.push({
            time: currentTime,
            value: interpolatedValue
          });
        }
      }
    }
    
    return result;
  }

  const cloneSeries = (seriesId, targetTime) => {
    if (!selectedTimeRange.value) return;
    
    const seriesIndex = series.value.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) return;
    
    const beforeData = getSeriesSnapshot([seriesId]);

    const { start, end } = selectedTimeRange.value;
    const sourceData = series.value[seriesIndex].data.filter(
      point => point && !isNaN(point.time) && !isNaN(point.value) &&
              point.time >= start && point.time <= end
    );
    
    if (sourceData.length === 0) return;
    
    const duration = end - start;
    const targetStart = targetTime;
    const targetEnd = targetTime + duration;
    
    const newData = [...series.value[seriesIndex].data];
    
    for (let i = newData.length - 1; i >= 0; i--) {
      const point = newData[i];
      if (point && !isNaN(point.time) && point.time >= targetStart && point.time <= targetEnd) {
        newData.splice(i, 1);
      }
    }
    
    sourceData.forEach(point => {
      const newPoint = {
        time: parseFloat((point.time - start + targetTime).toFixed(2)),
        value: parseFloat(point.value.toFixed(8))
      };
      newData.push(newPoint);
    });
    
    newData.sort((a, b) => a.time - b.time);
    const finalData = ensureDataPoints(newData);
    
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: finalData
    };
    
    const afterData = getSeriesSnapshot([seriesId]);
    recordOperation('clone', seriesId, { 
      sourceRange: { start, end }, 
      targetTime 
    }, beforeData, afterData);
  }

  const importData = (importedSeries) => {
    if (!importedSeries || importedSeries.length === 0) return
    
    importedSeries.forEach(imported => {
      const existingIndex = series.value.findIndex(s => s.id === imported.id)
      
      if (existingIndex !== -1) {
        series.value[existingIndex] = {
          ...series.value[existingIndex],
          data: imported.data
        }
      } else {
        addSeries({
          id: imported.id,
          data: imported.data,
          type: 'original',
          visible: true
        })
      }
    })
    
    saveState()
  }

  const undo = () => {
    if (operationIndex.value < 0) return;
    
    const operation = operations.value[operationIndex.value];
    
    if (operation.beforeData) {
      operation.seriesIds.forEach(id => {
        const seriesIndex = series.value.findIndex(s => s.id === id);
        if (seriesIndex !== -1 && operation.beforeData[id]) {
          series.value[seriesIndex] = {
            ...series.value[seriesIndex],
            data: JSON.parse(JSON.stringify(operation.beforeData[id]))
          };
        }
      });
    }
    
    operationIndex.value--;
    
    console.log(`Undid operation: ${operation.type}`);
  }

  const redo = () => {
    if (operationIndex.value >= operations.value.length - 1) return;
    
    operationIndex.value++;
    const operation = operations.value[operationIndex.value];
    
    if (operation.afterData) {
      operation.seriesIds.forEach(id => {
        const seriesIndex = series.value.findIndex(s => s.id === id);
        if (seriesIndex !== -1 && operation.afterData[id]) {
          series.value[seriesIndex] = {
            ...series.value[seriesIndex],
            data: JSON.parse(JSON.stringify(operation.afterData[id]))
          };
        }
      });
    }
    
    console.log(`Redid operation: ${operation.type}`);
  }

  const canUndo = computed(() => operationIndex.value >= 0);
  const canRedo = computed(() => operationIndex.value < operations.value.length - 1);

  const deleteSeries = (seriesId) => {
    const index = series.value.findIndex(s => s.id === seriesId)
    if (index !== -1) {
      if (selectedSeries.value.includes(seriesId)) {
        selectedSeries.value = selectedSeries.value.filter(id => id !== seriesId)
      }
      
      series.value.splice(index, 1)
      saveState()
    }
  }

  function triggerUpdate() {
    series.value = [...series.value];
  }

  function setViewport(newViewport) {
    viewport.value = newViewport;
  }

  const getViewport = computed(() => viewport.value);

  const updateEditedSeriesData = (data) => {
    const processedData = data.map(series => {
      const processedPoints = series.data.map(point => {
        let time = point.time;
        let value = point.value;
        
        if (typeof time === 'number') {
          time = parseFloat(time.toFixed(2));
        }
        
        if (typeof value === 'number') {
          value = parseFloat(value.toFixed(8));
        }
        
        return {
          time,
          value
        };
      });
      
      return {
        ...series,
        data: processedPoints
      };
    });
    
    editedSeriesData.value = processedData;
  }

  const ensureDataPoints = (data, expectedPoints = 1440) => {
    if (!data || data.length === 0) return [];
    
    if (data.length === expectedPoints) return data;
    
    const newData = new Array(expectedPoints);
    
    for (let i = 0; i < expectedPoints; i++) {
      const hour = i / 60;
      newData[i] = {
        time: parseFloat(hour.toFixed(2)),
        value: null
      };
    }
    
    data.sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < expectedPoints; i++) {
      const currentTime = i / 60;
      
      const leftIndex = data.findIndex(p => p.time > currentTime) - 1;
      const rightIndex = leftIndex + 1;
      
      if (leftIndex < 0) {
        newData[i].value = data[0].value;
      } else if (rightIndex >= data.length) {
        newData[i].value = data[data.length - 1].value;
      } else {
        const leftPoint = data[leftIndex];
        const rightPoint = data[rightIndex];
        const t = (currentTime - leftPoint.time) / (rightPoint.time - leftPoint.time);
        newData[i].value = parseFloat((leftPoint.value + t * (rightPoint.value - leftPoint.value)).toFixed(8));
      }
    }
    
    return newData;
  };

  const getSeriesSnapshot = (seriesIds) => {
    if (!seriesIds || !seriesIds.length) return null;
    
    const snapshot = {};
    seriesIds.forEach(id => {
      const seriesIndex = series.value.findIndex(s => s.id === id);
      if (seriesIndex !== -1) {
        snapshot[id] = JSON.parse(JSON.stringify(series.value[seriesIndex].data));
      }
    });
    
    return snapshot;
  }

  const recordOperation = (type, affectedSeriesIds, params = {}, beforeData = null, afterData = null) => {
    if (operationIndex.value < operations.value.length - 1) {
      operations.value = operations.value.slice(0, operationIndex.value + 1)
    }
    
    if (!beforeData && !afterData) {
      const seriesIds = Array.isArray(affectedSeriesIds) ? affectedSeriesIds : [affectedSeriesIds];
      
      afterData = getSeriesSnapshot(seriesIds);
      
      console.warn(`Operation ${type} recorded without before data`);
    }
    
    const operation = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      seriesIds: Array.isArray(affectedSeriesIds) ? affectedSeriesIds : [affectedSeriesIds],
      timeRange: selectedTimeRange.value ? { ...selectedTimeRange.value } : null,
      params,
      beforeData,
      afterData
    }
    
    operations.value.push(operation)
    
    if (operations.value.length > maxOperations) {
      operations.value.shift()
    }
    
    operationIndex.value = operations.value.length - 1
  }

  const exportEditHistory = () => {
    // 为每个操作确保beforeData和afterData可用
    const processedOperations = operations.value.map(op => {
      // 创建一个新对象，避免修改原始数据
      const processedOp = { ...op };
      
      // 确保beforeData和afterData存在
      if (!processedOp.beforeData || !processedOp.afterData) {
        console.warn(`Operation ${op.id} (${op.type}) has missing data`);
      }
      
      return processedOp;
    });
    
    return {
      operations: processedOperations,
      currentIndex: operationIndex.value
    };
  }

  const moveSeriesWithoutRecord = (seriesId, offset) => {
    if (!selectedTimeRange.value) return;

    const seriesIndex = series.value.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) return;

    const currentSeries = series.value[seriesIndex];
    const { start, end } = selectedTimeRange.value;

    const hasChildren = series.value.some(s => s.parentId === seriesId);

    if (currentSeries.parentId) {
      const parentIndex = series.value.findIndex(s => s.id === currentSeries.parentId);
      if (parentIndex !== -1) {
        const childSeries = series.value.filter(s => s.parentId === currentSeries.parentId);
        
        const newParentData = JSON.parse(JSON.stringify(series.value[parentIndex].data));
        
        const newData = JSON.parse(JSON.stringify(currentSeries.data));
        
        newData.forEach((point, i) => {
          if (point && point.time >= start && point.time <= end) {
            newData[i] = {
              time: point.time + offset.x,
              value: Math.max(0, Math.min(15000, point.value + offset.y))
            };
          }
        });
        
        newParentData.forEach((point, i) => {
          if (point) {
            point.value = 0;
            childSeries.forEach(child => {
              const childData = child.id === seriesId ? newData : child.data;
              if (childData[i] && childData[i].time === point.time) {
                point.value += childData[i].value;
              }
            });
          }
        });
        
        series.value[seriesIndex] = {
          ...currentSeries,
          data: newData
        };
        
        series.value[parentIndex] = {
          ...series.value[parentIndex],
          data: newParentData
        };
      }
    } else {
      if (hasChildren) {
        console.warn('Modifying parent series will break consistency with child series');
      }
      
      const newData = JSON.parse(JSON.stringify(currentSeries.data));
      
      newData.forEach((point, i) => {
        if (point && point.time >= start && point.time <= end) {
          newData[i] = {
            time: point.time + offset.x,
            value: Math.max(0, Math.min(15000, point.value + offset.y))
          };
        }
      });
      
      newData.sort((a, b) => a.time - b.time);
      
      series.value[seriesIndex] = {
        ...currentSeries,
        data: newData
      };
    }

    series.value[seriesIndex].data = ensureDataPoints(series.value[seriesIndex].data);
  }

  const recordBatchOperation = (type, affectedSeriesIds, params = {}, beforeData = null, afterData = null) => {
    if (operationIndex.value < operations.value.length - 1) {
      operations.value = operations.value.slice(0, operationIndex.value + 1);
    }
    
    if (!beforeData || !afterData) {
      console.warn(`Batch operation ${type} recorded with incomplete data`);
    }
    
    const operation = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      seriesIds: Array.isArray(affectedSeriesIds) ? affectedSeriesIds : [affectedSeriesIds],
      timeRange: selectedTimeRange.value ? { ...selectedTimeRange.value } : null,
      params,
      beforeData,
      afterData
    };
    
    operations.value.push(operation);
    
    if (operations.value.length > maxOperations) {
      operations.value.shift();
    }
    
    operationIndex.value = operations.value.length - 1;
    
    console.log(`Recorded batch operation: ${type}`);
  };

  const convertTimeStringToHours = (timeStr) => {
    if (!timeStr) return 0;
    
    // 如果已经是数字，直接返回
    if (typeof timeStr === 'number') return timeStr;
    
    // 如果是时间字符串格式
    if (typeof timeStr === 'string') {
      // 处理包含日期的完整时间戳 (YYYY-MM-DD HH:MM:SS)
      if (timeStr.includes('-') && timeStr.includes(' ')) {
        // 提取时间部分
        const timePart = timeStr.split(' ')[1];
        if (timePart) {
          const parts = timePart.split(':').map(Number);
          if (parts.length >= 2) {
            const hours = parts[0];
            const minutes = parts[1];
            const seconds = parts.length > 2 ? parts[2] : 0;
            
            // 确保时间范围在0-24小时内
            const decimalHours = hours + (minutes / 60) + (seconds / 3600);
            
            console.log(`时间转换(日期时间): "${timeStr}" => ${decimalHours.toFixed(4)}小时`);
            return decimalHours;
          }
        }
      }
      
      // 处理标准时间格式 (HH:MM:SS 或 HH:MM)
      const parts = timeStr.split(':').map(Number);
      if (parts.length >= 2) {
        const hours = parts[0];
        const minutes = parts[1];
        const seconds = parts.length > 2 ? parts[2] : 0;
        
        // 确保时间范围在0-24小时内
        const decimalHours = hours + (minutes / 60) + (seconds / 3600);
        
        console.log(`时间转换(标准时间): "${timeStr}" => ${decimalHours.toFixed(4)}小时`);
        return decimalHours;
      }
    }
    
    console.warn(`无法解析的时间格式: ${timeStr}, 类型: ${typeof timeStr}`);
    return 0;
  };

  const calculatePatternEnergy = (data) => {
    if (!data || data.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < data.length; i++) {
      sum += Math.abs(data[i].value - data[i-1].value);
    }
    
    return sum / (data.length - 1);
  };

  const getColorForEnergy = (energy) => {
    if (energy > 5) return '#6548C7';
    if (energy > 2) return '#9B71F6';
    return '#8367F8';
  };

  // 提取日期函数
  const extractDateFromTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'string') return '';
    
    // 尝试从时间戳中提取日期部分
    if (timestamp.includes('-') && timestamp.includes(' ')) {
      return timestamp.split(' ')[0]; // 提取YYYY-MM-DD部分
    }
    return '';
  };

  return {
    series,
    selectedTimeRange,
    selectedSeries,
    previewSeries,
    addSeries,
    initializeData,
    setSelection,
    clearSelection,
    moveSeries,
    applyCurve,
    expandTimeSeries,
    cloneSeries,
    undo,
    redo,
    canUndo,
    canRedo,
    findSimilarPatterns,
    replaceWithPattern,
    importData,
    setPreviewSeries,
    clearPreviewSeries,
    deleteSeries,
    triggerUpdate,
    viewport,
    setViewport,
    getViewport,
    editedSeriesData,
    updateEditedSeriesData,
    exportEditHistory,
    operations: computed(() => operations.value),
    operationIndex,
    moveSeriesWithoutRecord,
    recordBatchOperation,
    getSeriesSnapshot
  }
})