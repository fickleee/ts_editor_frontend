import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as d3 from 'd3'
import { generateHouseData } from '../utils/generateData'
import { ElMessage } from 'element-plus'

export const useTimeSeriesStore = defineStore('timeSeries', () => {
  const series = ref([])
  const history = ref([])
  const historyIndex = ref(-1)
  const maxHistory = 50

  const selectedTimeRange = ref(null)
  const selectedSeries = ref([])
  const previewSeries = ref(null)

  const viewport = ref({
    start: 0,
    end: 24
  });

  // 添加用于存储从右侧发送到左侧的数据
  const editedSeriesData = ref([]);

  const initializeData = () => {
    // Generate data for three consecutive days
    const defaultSeries = ['Default 1', 'Default 2', 'Default 3']
    defaultSeries.forEach((name, index) => {
      const data = generateHouseData(1) // Generate one day of data
      addSeries({
        id: name,
        data,
        type: 'original',
        visible: true
      })
    })
  }

  const addSeries = (newSeries) => {
    // 检查系列是否已经存在
    const existingSeries = series.value.find(s => s.id === newSeries.id);
    if (!existingSeries) {
      series.value.push(newSeries);
    } else {
      // 更新已存在的系列
      Object.assign(existingSeries, newSeries);
    }
    saveState()
  }

  const saveState = () => {
    // 在保存前检查所有序列的数据点数量
    series.value.forEach(s => {
      if (s.data.length !== 1440) {
        console.warn(`Series ${s.id} has ${s.data.length} points, fixing...`);
        s.data = ensureDataPoints(s.data);
      }
    });
    
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1)
    }
    history.value.push(JSON.parse(JSON.stringify(series.value)))
    if (history.value.length > maxHistory) {
      history.value.shift()
    }
    historyIndex.value = history.value.length - 1
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

    // Create preview series with pattern data adjusted to selection range
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

    // 获取当前序列
    const currentSeries = series.value[seriesIndex]
    const { start, end } = selectedTimeRange.value

    // 检查这个序列是否有子序列
    const hasChildren = series.value.some(s => s.parentId === seriesId)

    // 如果是子序列，需要更新父序列
    if (currentSeries.parentId) {
      const parentIndex = series.value.findIndex(s => s.id === currentSeries.parentId)
      if (parentIndex !== -1) {
        // 获取所有子序列
        const childSeries = series.value.filter(s => s.parentId === currentSeries.parentId)
        
        // 创建父序列的新数据
        const newParentData = JSON.parse(JSON.stringify(series.value[parentIndex].data))
        
        // 更新当前子序列的数据
        const newData = JSON.parse(JSON.stringify(currentSeries.data))
        
        newData.forEach((point, i) => {
          if (point && point.time >= start && point.time <= end) {
            newData[i] = {
              time: point.time + offset.x,
              value: Math.max(0, Math.min(15000, point.value + offset.y))
            }
          }
        })
        
        // 更新父序列数据（所有子序列之和）
        newParentData.forEach((point, i) => {
          if (point) {
            point.value = 0; // 重置为0
            // 累加所有子序列的值
            childSeries.forEach(child => {
              const childData = child.id === seriesId ? newData : child.data;
              if (childData[i] && childData[i].time === point.time) {
                point.value += childData[i].value;
              }
            });
          }
        })
        
        // 更新子序列和父序列
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
      // 是原始序列或父序列
      // 如果有子序列，提示用户但仍允许编辑
      if (hasChildren) {
        ElMessage.warning('Warning: Modifying the parent series will break consistency with child series')
      }
      
      // 正常编辑序列
      const newData = JSON.parse(JSON.stringify(currentSeries.data))
      
      newData.forEach((point, i) => {
        if (point && point.time >= start && point.time <= end) {
          newData[i] = {
            time: point.time + offset.x,
            value: Math.max(0, Math.min(15000, point.value + offset.y))
          }
        }
      })
      
      // 排序数据
      newData.sort((a, b) => a.time - b.time)
      
      series.value[seriesIndex] = {
        ...currentSeries,
        data: newData
      }
    }

    // 在保存前确保数据点数量正确
    series.value[seriesIndex].data = ensureDataPoints(series.value[seriesIndex].data);
    saveState()
  }

  const applyCurve = (seriesId, curve) => {
    if (!selectedTimeRange.value) return

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    // 复制数据避免直接修改
    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))
    const { start, end } = selectedTimeRange.value
    const duration = end - start

    // 对选中范围内的每个数据点应用曲线
    newData.forEach((point, i) => {
      if (point.time >= start && point.time <= end) {
        // 计算当前点在选择范围内的相对位置（0-1）
        const relativePosition = (point.time - start) / duration
        
        // 使用曲线在该位置的 y 值作为乘数
        const multiplier = interpolateCurveAtPosition(curve, relativePosition)
        
        // 应用乘数到原始值
        newData[i] = {
          time: point.time,
          value: point.value * multiplier
        }
      }
    })

    // 更新数据
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }

    // 在保存前确保数据点数量正确
    series.value[seriesIndex].data = ensureDataPoints(series.value[seriesIndex].data);
    saveState()
  }

  // 根据相对位置插值曲线值
  const interpolateCurveAtPosition = (curve, position) => {
    // 确保位置在0-1范围内
    position = Math.max(0, Math.min(1, position))
    
    // 找到位置两侧的控制点
    let leftIndex = 0
    let rightIndex = curve.length - 1
    
    for (let i = 0; i < curve.length - 1; i++) {
      if (curve[i].x <= position && curve[i + 1].x >= position) {
        leftIndex = i
        rightIndex = i + 1
        break
      }
    }
    
    // 如果位置恰好在控制点上，直接返回该点的 y 值
    if (curve[leftIndex].x === position) return curve[leftIndex].y
    if (curve[rightIndex].x === position) return curve[rightIndex].y
    
    // 否则线性插值
    const t = (position - curve[leftIndex].x) / (curve[rightIndex].x - curve[leftIndex].x)
    return curve[leftIndex].y + t * (curve[rightIndex].y - curve[leftIndex].y)
  }

  const expandTimeSeries = (selections) => {
    if (!selections || selections.length === 0) return;
    
    // 计算总时长和缩放因子
    const totalSelectedTime = selections.reduce((sum, sel) => sum + (sel.end - sel.start), 0);
    const scaleFactor = 24 / totalSelectedTime;
    
    selectedSeries.value.forEach(id => {
      const seriesIndex = series.value.findIndex(s => s.id === id);
      if (seriesIndex === -1) return;
      
      const originalData = series.value[seriesIndex].data;
      const newData = new Array(1440); // 24小时 * 60分钟 = 1440个点
      
      // 初始化每分钟的时间点
      for (let i = 0; i < 1440; i++) {
        const hour = i / 60;
        newData[i] = {
          time: parseFloat(hour.toFixed(2)),
          value: null // 先初始化为null，后面会填充实际值
        };
      }
      
      // 处理选中的片段
      let currentTime = 0;
      
      // 辅助函数：在两点之间进行线性插值
      const interpolate = (time, p1, p2) => {
        const t = (time - p1.time) / (p2.time - p1.time);
        return p1.value + t * (p2.value - p1.value);
      };
      
      // 辅助函数：获取某个时间点的插值结果
      const getValueAtTime = (time, data) => {
        const points = data.filter(p => p && !isNaN(p.time) && !isNaN(p.value));
        if (points.length === 0) return null;
        if (points.length === 1) return points[0].value;
        
        const i = points.findIndex(p => p.time > time);
        if (i === 0) return points[0].value;
        if (i === -1) return points[points.length - 1].value;
        
        return interpolate(time, points[i - 1], points[i]);
      };
      
      // 处理每个选中片段
      selections.forEach((selection, index) => {
        const segmentData = originalData.filter(
          point => point && !isNaN(point.time) && !isNaN(point.value) &&
                  point.time >= selection.start && point.time <= selection.end
        );
        
        if (segmentData.length === 0) return;
        
        // 计算这个片段应该占用的时间范围
        const segmentDuration = (selection.end - selection.start) * scaleFactor;
        const segmentEndTime = currentTime + segmentDuration;
        
        // 为这个片段的每一分钟生成数据点
        for (let minute = Math.floor(currentTime * 60); minute < Math.floor(segmentEndTime * 60); minute++) {
          if (minute >= 1440) break; // 确保不超过24小时
          
          // 计算原始时间范围内的相对位置
          const progress = (minute / 60 - currentTime) / segmentDuration;
          const originalTime = selection.start + progress * (selection.end - selection.start);
          
          // 使用线性插值获取该时间点的值
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
      
      // 填充未被选中片段的数据点
      for (let i = 0; i < 1440; i++) {
        if (newData[i].value === null) {
          // 使用前后有效值的平均值，或者最近的有效值
          let prevValue = null;
          let nextValue = null;
          
          // 向前找最近的有效值
          for (let j = i - 1; j >= 0; j--) {
            if (newData[j].value !== null) {
              prevValue = newData[j].value;
              break;
            }
          }
          
          // 向后找最近的有效值
          for (let j = i + 1; j < 1440; j++) {
            if (newData[j].value !== null) {
              nextValue = newData[j].value;
              break;
            }
          }
          
          // 如果两边都有值，取平均值；否则使用有效的那个值
          if (prevValue !== null && nextValue !== null) {
            newData[i].value = parseFloat(((prevValue + nextValue) / 2).toFixed(8));
          } else if (prevValue !== null) {
            newData[i].value = prevValue;
          } else if (nextValue !== null) {
            newData[i].value = nextValue;
          } else {
            // 如果没有任何有效值，使用原始数据的第一个值
            newData[i].value = originalData[0]?.value || 0;
          }
        }
      }
      
      // 直接更新原序列的数据
      series.value[seriesIndex] = {
        ...series.value[seriesIndex],
        data: newData
      };
    });
    
    // 清除选择
    clearSelection();
    
    // 保存状态
    saveState();
  }

  const findSimilarPatterns = (seriesId) => {
    if (!selectedTimeRange.value || !seriesId) return []
    
    const sourceSeries = series.value.find(s => s.id === seriesId)
    if (!sourceSeries) return []

    const patterns = []
    const { start, end } = selectedTimeRange.value
    const duration = end - start

    // 获取当前选择区域的边界值
    const sourceData = sourceSeries.data
    const leftValue = interpolateValue(sourceData, start)
    const rightValue = interpolateValue(sourceData, end)

    // 获取所选模式的数据
    const selectedPattern = sourceData.filter(p => 
      p && !isNaN(p.time) && !isNaN(p.value) && 
      p.time >= start && p.time <= end
    )

    // 遍历所有曲线数据
    for (const currentSeries of series.value) {
      // 获取当前曲线数据
      const currentData = currentSeries.data
      
      // 使用滑动窗口搜索相似模式
      for (let i = 0; i < currentData.length; i++) {
        const point = currentData[i]
        if (!point || isNaN(point.time) || isNaN(point.value)) continue
        
        const windowStart = point.time
        const windowEnd = windowStart + duration

        if (windowEnd > 24) break

        // 跳过与当前选择相同的区域
        if (currentSeries.id === seriesId && 
            Math.abs(windowStart - start) < 0.1 && 
            Math.abs(windowEnd - end) < 0.1) continue

        const windowData = currentData.filter(p => 
          p && !isNaN(p.time) && !isNaN(p.value) && 
          p.time >= windowStart && p.time <= windowEnd
        )
        
        if (windowData.length < 2) continue

        // 获取边界值
        const windowLeftValue = interpolateValue(currentData, windowStart)
        const windowRightValue = interpolateValue(currentData, windowEnd)

        // 只基于边界值计算相似度
        const leftDiff = Math.abs(leftValue - windowLeftValue)
        const rightDiff = Math.abs(rightValue - windowRightValue)
        
        // 边界值差异归一化为相似度 (0-1)
        const maxPossibleDiff = 10  // 假设最大可能差异是10
        const leftSimilarity = 1 - Math.min(leftDiff / maxPossibleDiff, 1)
        const rightSimilarity = 1 - Math.min(rightDiff / maxPossibleDiff, 1)
        
        // 计算综合相似度，只基于边界匹配
        const similarity = (leftSimilarity + rightSimilarity) / 2

        // 仅包含相似度高的模式
        if (similarity > 0.7) {
          // 根据曲线类型设置颜色
          let seriesColor;
          switch (currentSeries.type) {
            case 'LF':
              seriesColor = '#92400E'; // 低频颜色
              break;
            case 'MF':
              seriesColor = '#9D174D'; // 中频颜色
              break;
            case 'HF':
              seriesColor = '#3730A3'; // 高频颜色
              break;
            default:
              // 使用序号生成颜色
              const colorIndex = series.value.findIndex(s => s.id === currentSeries.id) % 3;
              const defaultColors = ['#2563eb', '#dc2626', '#16a34a']; // 蓝色、红色、绿色
              seriesColor = defaultColors[colorIndex >= 0 ? colorIndex : 0];
          }
          
          patterns.push({
            seriesId: currentSeries.id,
            start: windowStart,
            end: windowEnd,
            data: windowData,
            similarity,
            leftValue: windowLeftValue,
            rightValue: windowRightValue,
            color: seriesColor,
            sourceName: currentSeries.id, // 添加来源曲线名称
            sourceType: currentSeries.type || 'original' // 添加来源曲线类型
          });
        }
      }
    }

    // 根据相似度排序
    patterns.sort((a, b) => b.similarity - a.similarity)
    
    // 返回前10个最相似的模式
    return patterns.slice(0, 10)
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
    
    // Avoid division by zero
    if (Math.abs(next.time - prev.time) < 0.0001) return prev.value
    
    const t = (time - prev.time) / (next.time - prev.time)
    return prev.value + t * (next.value - prev.value)
  }

  const replaceWithPattern = (pattern, seriesId) => {
    if (!selectedTimeRange.value || !seriesId) return

    const { start, end } = selectedTimeRange.value
    const duration = end - start

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    // Create a deep copy of the data to avoid mutation issues
    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))
    
    // Get values at selection boundaries for smooth transition
    const leftValue = interpolateValue(newData, start)
    const rightValue = interpolateValue(newData, end)
    
    // Get values at pattern boundaries
    const patternLeftValue = pattern.leftValue
    const patternRightValue = pattern.rightValue
    
    // Calculate scale and offset for value adjustment to match boundaries
    const patternData = pattern.data.filter(p => 
      p && p.time !== null && p.time !== undefined && 
      p.value !== null && p.value !== undefined && 
      !isNaN(p.time) && !isNaN(p.value)
    )
    
    if (patternData.length < 2) return
    
    const patternMin = Math.min(...patternData.map(p => p.value))
    const patternMax = Math.max(...patternData.map(p => p.value))
    
    // Remove existing points in the selection range
    for (let i = newData.length - 1; i >= 0; i--) {
      const point = newData[i]
      if (point && !isNaN(point.time) && point.time >= start && point.time <= end) {
        newData.splice(i, 1)
      }
    }
    
    // Add new points from the pattern with time adjustment
    patternData.forEach(point => {
      // Normalize the time to fit the selection range
      const normalizedTime = (point.time - pattern.start) / (pattern.end - pattern.start)
      const newTime = start + normalizedTime * duration
      
      // Adjust value to match boundary conditions
      let adjustedValue = point.value
      
      // Apply boundary matching
      if (normalizedTime < 0.1) {
        // Blend with left boundary
        const blendFactor = normalizedTime / 0.1
        adjustedValue = leftValue * (1 - blendFactor) + point.value * blendFactor
      } else if (normalizedTime > 0.9) {
        // Blend with right boundary
        const blendFactor = (normalizedTime - 0.9) / 0.1
        adjustedValue = point.value * (1 - blendFactor) + rightValue * blendFactor
      }
      
      newData.push({
        time: newTime,
        value: adjustedValue
      })
    })
    
    // Sort data by time
    newData.sort((a, b) => a.time - b.time)
    
    // Apply smooth transitions at boundaries
    const transitionRange = 0.5 // Hours for transition
    const startTransition = Math.max(0, start - transitionRange)
    const endTransition = Math.min(24, end + transitionRange)
    
    // Apply smooth transitions outside the selection
    for (let i = 0; i < newData.length; i++) {
      const point = newData[i]
      if (!point || isNaN(point.time) || isNaN(point.value)) continue
      
      if (point.time >= startTransition && point.time < start) {
        // Smooth transition before selection
        const progress = (point.time - startTransition) / transitionRange
        const easeProgress = d3.easeCubicInOut(progress)
        
        const originalValue = point.value
        const nextPoint = newData.find(p => p && !isNaN(p.time) && !isNaN(p.value) && p.time >= start)
        if (nextPoint) {
          newData[i].value = originalValue * (1 - easeProgress) + nextPoint.value * easeProgress
        }
      } else if (point.time > end && point.time <= endTransition) {
        // Smooth transition after selection
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
    
    // Update series with new data
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }
    
    saveState()
  }

  const cloneSeries = (seriesId, targetTime) => {
    if (!selectedTimeRange.value) return;
    
    const seriesIndex = series.value.findIndex(s => s.id === seriesId);
    if (seriesIndex === -1) return;
    
    const { start, end } = selectedTimeRange.value;
    const sourceData = series.value[seriesIndex].data.filter(
      point => point && !isNaN(point.time) && !isNaN(point.value) &&
              point.time >= start && point.time <= end
    );
    
    if (sourceData.length === 0) return;
    
    // 获取目标时间范围
    const duration = end - start;
    const targetStart = targetTime;
    const targetEnd = targetTime + duration;
    
    // 复制当前数据
    const newData = [...series.value[seriesIndex].data];
    
    // 移除目标范围内的现有点
    for (let i = newData.length - 1; i >= 0; i--) {
      const point = newData[i];
      if (point && !isNaN(point.time) && point.time >= targetStart && point.time <= targetEnd) {
        newData.splice(i, 1);
      }
    }
    
    // 添加克隆的点
    sourceData.forEach(point => {
      const newPoint = {
        time: parseFloat((point.time - start + targetTime).toFixed(2)),
        value: parseFloat(point.value.toFixed(8))
      };
      newData.push(newPoint);
    });
    
    // 排序并确保数据点数量正确
    newData.sort((a, b) => a.time - b.time);
    const finalData = ensureDataPoints(newData);
    
    // 更新序列
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: finalData
    };
    
    saveState();
  }

  const importData = (importedSeries) => {
    if (!importedSeries || importedSeries.length === 0) return
    
    // Add each imported series
    importedSeries.forEach(imported => {
      // Check if a series with this ID already exists
      const existingIndex = series.value.findIndex(s => s.id === imported.id)
      
      if (existingIndex !== -1) {
        // Update existing series
        series.value[existingIndex] = {
          ...series.value[existingIndex],
          data: imported.data
        }
      } else {
        // Add new series
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
    if (historyIndex.value > 0) {
      historyIndex.value--
      series.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    }
  }

  const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      series.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    }
  }

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // 添加删除系列的方法
  const deleteSeries = (seriesId) => {
    const index = series.value.findIndex(s => s.id === seriesId)
    if (index !== -1) {
      // 如果这个系列是被选中的，清除选择
      if (selectedSeries.value.includes(seriesId)) {
        selectedSeries.value = selectedSeries.value.filter(id => id !== seriesId)
      }
      
      // 删除系列
      series.value.splice(index, 1)
      saveState()
    }
  }

  function triggerUpdate() {
    // This is a dummy method to trigger reactivity updates
    // We just need to touch a reactive property
    series.value = [...series.value];
  }

  function setViewport(newViewport) {
    viewport.value = newViewport;
  }

  const getViewport = computed(() => viewport.value);

  // 添加修改函数
  const updateEditedSeriesData = (data) => {
    // 处理数据，确保数值格式正确
    const processedData = data.map(series => {
      // 处理每个数据点
      const processedPoints = series.data.map(point => {
        let time = point.time;
        let value = point.value;
        
        // 如果时间是数字，保留两位小数
        if (typeof time === 'number') {
          time = parseFloat(time.toFixed(2));
        }
        
        // 值保留八位小数
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

  // 添加一个辅助函数来检查和修复数据点数量
  const ensureDataPoints = (data, expectedPoints = 1440) => {
    if (!data || data.length === 0) return [];
    
    // 如果点数正确，直接返回
    if (data.length === expectedPoints) return data;
    
    const newData = new Array(expectedPoints);
    
    // 初始化时间点
    for (let i = 0; i < expectedPoints; i++) {
      const hour = i / 60;
      newData[i] = {
        time: parseFloat(hour.toFixed(2)),
        value: null
      };
    }
    
    // 对现有数据进行插值
    data.sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < expectedPoints; i++) {
      const currentTime = i / 60;
      
      // 找到最近的两个点进行插值
      const leftIndex = data.findIndex(p => p.time > currentTime) - 1;
      const rightIndex = leftIndex + 1;
      
      if (leftIndex < 0) {
        // 在开始之前
        newData[i].value = data[0].value;
      } else if (rightIndex >= data.length) {
        // 在结束之后
        newData[i].value = data[data.length - 1].value;
      } else {
        // 进行线性插值
        const leftPoint = data[leftIndex];
        const rightPoint = data[rightIndex];
        const t = (currentTime - leftPoint.time) / (rightPoint.time - leftPoint.time);
        newData[i].value = parseFloat((leftPoint.value + t * (rightPoint.value - leftPoint.value)).toFixed(8));
      }
    }
    
    return newData;
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
    updateEditedSeriesData
  }
})