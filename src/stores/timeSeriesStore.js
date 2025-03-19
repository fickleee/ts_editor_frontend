import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as d3 from 'd3'
import { generateHouseData } from '../utils/generateData'

export const useTimeSeriesStore = defineStore('timeSeries', () => {
  const series = ref([])
  const history = ref([])
  const historyIndex = ref(-1)
  const maxHistory = 50

  const selectedTimeRange = ref(null)
  const selectedSeries = ref([])
  const previewSeries = ref(null)

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

    // Create a deep copy of the data to avoid mutation issues
    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))
    const { start, end } = selectedTimeRange.value

    // Move selected portion
    newData.forEach((point, i) => {
      if (point && point.time >= start && point.time <= end) {
        newData[i] = {
          time: point.time + offset.x,
          value: Math.max(0, Math.min(100, point.value + offset.y))
        }
      }
    })

    // Sort data by time
    newData.sort((a, b) => a.time - b.time)

    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }

    saveState()
  }

  const applyCurve = (seriesId, curve) => {
    if (!selectedTimeRange.value) return

    const seriesIndex = series.value.findIndex(s => s.id === seriesId)
    if (seriesIndex === -1) return

    const { start, end } = selectedTimeRange.value
    
    // Create a deep copy of the data to avoid mutation issues
    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))

    // Get value range of selected data
    const selectedData = newData.filter(point => 
      point && 
      !isNaN(point.time) && 
      !isNaN(point.value) && 
      point.time >= start && 
      point.time <= end
    )
    
    if (selectedData.length === 0) return

    // Safely calculate min and max values
    const validValues = selectedData
      .map(p => p.value)
      .filter(v => v !== null && v !== undefined && !isNaN(v))
    
    if (validValues.length === 0) return
    
    const minValue = Math.min(...validValues)
    const maxValue = Math.max(...validValues)
    const valueRange = maxValue - minValue

    // Create interpolation function from curve points
    const curveInterpolate = d3.scaleLinear()
      .domain(curve.map(p => p.x))
      .range(curve.map(p => p.y))
      .clamp(true)

    // Calculate transition ranges
    const transitionRange = 0.5 // Hours for transition
    const startTransition = Math.max(0, start - transitionRange)
    const endTransition = Math.min(24, end + transitionRange)

    // Apply curve transformation with smooth transitions
    for (let i = 0; i < newData.length; i++) {
      const point = newData[i]
      
      // Skip invalid points
      if (!point || 
          point.time === null || 
          point.time === undefined || 
          point.value === null || 
          point.value === undefined || 
          isNaN(point.time) || 
          isNaN(point.value)) {
        continue
      }
      
      if (point.time >= start && point.time <= end) {
        // Main curve transformation
        // Handle edge case where valueRange is 0 (flat line)
        if (valueRange === 0 || valueRange < 0.0001) {
          // If the range is 0, just keep the same value
          newData[i].value = minValue
        } else {
          // Normal case - apply curve transformation
          const normalizedValue = (point.value - minValue) / valueRange
          const transformedNormal = curveInterpolate(normalizedValue)
          const transformedValue = transformedNormal * valueRange + minValue
          newData[i].value = Math.max(0, Math.min(100, transformedValue))
        }
      } else if (point.time >= startTransition && point.time < start) {
        // Smooth transition before selection
        const progress = (point.time - startTransition) / transitionRange
        const easeProgress = d3.easeCubicInOut(progress)
        
        // Find the closest point at the start of the selection
        const closestStartPoint = findClosestPoint(newData, start)
        
        if (closestStartPoint && closestStartPoint.value !== null && closestStartPoint.value !== undefined && !isNaN(closestStartPoint.value)) {
          // Calculate what this point's value would be after transformation
          let transformedStartValue
          
          if (valueRange === 0 || valueRange < 0.0001) {
            transformedStartValue = minValue
          } else {
            const normalizedStart = (closestStartPoint.value - minValue) / valueRange
            const transformedNormal = curveInterpolate(normalizedStart)
            transformedStartValue = transformedNormal * valueRange + minValue
          }
          
          // Blend between original and transformed
          newData[i].value = point.value * (1 - easeProgress) + transformedStartValue * easeProgress
        }
      } else if (point.time > end && point.time <= endTransition) {
        // Smooth transition after selection
        const progress = (point.time - end) / transitionRange
        const easeProgress = d3.easeCubicInOut(progress)
        
        // Find the closest point at the end of the selection
        const closestEndPoint = findClosestPoint(newData, end)
        
        if (closestEndPoint && closestEndPoint.value !== null && closestEndPoint.value !== undefined && !isNaN(closestEndPoint.value)) {
          // Calculate what this point's value would be after transformation
          let transformedEndValue
          
          if (valueRange === 0 || valueRange < 0.0001) {
            transformedEndValue = minValue
          } else {
            const normalizedEnd = (closestEndPoint.value - minValue) / valueRange
            const transformedNormal = curveInterpolate(normalizedEnd)
            transformedEndValue = transformedNormal * valueRange + minValue
          }
          
          // Blend between transformed and original
          newData[i].value = transformedEndValue * (1 - easeProgress) + point.value * easeProgress
        }
      }
    }

    // Make sure we preserve all data points
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }

    saveState()
  }

  // Helper function to find the closest point to a given time
  const findClosestPoint = (data, time) => {
    if (!data || data.length === 0) return null
    
    let closestPoint = null
    let minDistance = Infinity
    
    for (const point of data) {
      if (point && 
          point.time !== null && 
          point.time !== undefined && 
          !isNaN(point.time) &&
          point.value !== null &&
          point.value !== undefined &&
          !isNaN(point.value)) {
        const distance = Math.abs(point.time - time)
        if (distance < minDistance) {
          minDistance = distance
          closestPoint = point
        }
      }
    }
    
    return closestPoint
  }

  const expandTimeSeries = (selections) => {
    if (!selections.length || !selectedSeries.value.length) return

    const totalDuration = selections.reduce((sum, sel) => sum + (sel.end - sel.start), 0)
    const scaleFactor = 24 / totalDuration

    selectedSeries.value.forEach(id => {
      const seriesIndex = series.value.findIndex(s => s.id === id)
      if (seriesIndex === -1) return

      const originalData = series.value[seriesIndex].data
      const newData = []
      let currentTime = 0

      // Helper function to get interpolated value at a specific time
      const getInterpolatedValue = (time) => {
        const points = originalData.filter(p => p && !isNaN(p.time) && !isNaN(p.value))
        if (points.length < 2) return null

        const i = d3.bisector(d => d.time).left(points, time)
        if (i === 0) return points[0].value
        if (i === points.length) return points[points.length - 1].value

        const a = points[i - 1]
        const b = points[i]
        const t = (time - a.time) / (b.time - a.time)
        return a.value + t * (b.value - a.value)
      }

      // Add points at the start (0:00) if needed
      if (selections[0].start > 0) {
        const startValue = getInterpolatedValue(0)
        if (startValue !== null) {
          newData.push({ time: 0, value: startValue })
        }
      }

      // Process each selected segment
      selections.forEach((selection, index) => {
        const segmentData = originalData.filter(
          point => point && !isNaN(point.time) && !isNaN(point.value) &&
                  point.time >= selection.start && point.time <= selection.end
        )

        // Add transition points between segments if there's a gap
        if (index > 0) {
          const prevSegmentEnd = currentTime
          const thisSegmentStart = currentTime
          if (Math.abs(prevSegmentEnd - thisSegmentStart) > 0.001) {
            const transitionPoints = 5
            for (let i = 1; i < transitionPoints; i++) {
              const t = i / transitionPoints
              const time = prevSegmentEnd + t * (thisSegmentStart - prevSegmentEnd)
              const prevValue = newData[newData.length - 1].value
              const nextValue = segmentData[0].value
              const value = prevValue + t * (nextValue - prevValue)
              newData.push({ time, value })
            }
          }
        }

        // Add segment data points
        segmentData.forEach(point => {
          const relativeTime = point.time - selection.start
          const scaledTime = currentTime + (relativeTime * scaleFactor)
          newData.push({
            time: scaledTime,
            value: point.value
          })
        })

        currentTime += (selection.end - selection.start) * scaleFactor
      })

      // Add points at the end (24:00) if needed
      if (currentTime < 24) {
        const endValue = getInterpolatedValue(24)
        if (endValue !== null) {
          // Add transition points to smooth the connection
          const lastPoint = newData[newData.length - 1]
          const transitionPoints = 5
          for (let i = 1; i <= transitionPoints; i++) {
            const t = i / transitionPoints
            const time = lastPoint.time + t * (24 - lastPoint.time)
            const value = lastPoint.value + t * (endValue - lastPoint.value)
            newData.push({ time, value })
          }
        }
      }

      // Ensure the data covers the full 24-hour range
      if (newData[0].time > 0) {
        newData.unshift({ time: 0, value: newData[0].value })
      }
      if (newData[newData.length - 1].time < 24) {
        newData.push({ time: 24, value: newData[newData.length - 1].value })
      }

      // Sort data by time and remove any duplicate points
      const uniqueData = newData
        .sort((a, b) => a.time - b.time)
        .filter((point, index, self) => 
          index === 0 || 
          Math.abs(point.time - self[index - 1].time) > 0.001
        )

      series.value[seriesIndex] = {
        ...series.value[seriesIndex],
        data: uniqueData
      }
    })

    saveState()
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

  const cloneSeries = (sourceId, targetTime) => {
    if (!selectedTimeRange.value) return

    const { start, end } = selectedTimeRange.value

    // Get the source series
    const sourceSeries = series.value.find(s => s.id === sourceId && s.visible)
    if (!sourceSeries) return

    // Check if the target range is within the series bounds
    const targetStart = targetTime
    const targetEnd = targetTime + (end - start)
    if (targetStart < 0 || targetEnd > 24) return

    // Get source data within selection
    const sourceData = sourceSeries.data.filter(
      point => point && !isNaN(point.time) && !isNaN(point.value) && 
              point.time >= start && point.time <= end
    )

    // Create new data array for target series
    const seriesIndex = series.value.findIndex(s => s.id === sourceId)
    if (seriesIndex === -1) return
    
    // Create a deep copy of the data to avoid mutation issues
    const newData = JSON.parse(JSON.stringify(series.value[seriesIndex].data))

    // Remove existing points in target range
    for (let i = newData.length - 1; i >= 0; i--) {
      const point = newData[i]
      if (point && !isNaN(point.time) && point.time >= targetStart && point.time <= targetEnd) {
        newData.splice(i, 1)
      }
    }

    // Add cloned points with exact time offsets
    sourceData.forEach(point => {
      const newPoint = {
        time: point.time - start + targetTime,
        value: point.value
      }
      
      // Ensure we don't add duplicate time points
      if (!newData.some(p => p && !isNaN(p.time) && Math.abs(p.time - newPoint.time) < 0.001)) {
        newData.push(newPoint)
      }
    })

    // Sort data by time
    newData.sort((a, b) => a.time - b.time)

    // Update target series
    series.value[seriesIndex] = {
      ...series.value[seriesIndex],
      data: newData
    }

    saveState()
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
    deleteSeries
  }
})