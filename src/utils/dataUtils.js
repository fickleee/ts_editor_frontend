/**
 * 对数据进行降采样，保留数据特征
 * @param {Array} data - 原始数据点数组
 * @param {number} threshold - 降采样后的目标点数
 * @returns {Array} 降采样后的数据
 */
export function downsampleData(data, threshold = 300) {
  if (!data || data.length <= threshold) return data;
  
  // 使用LTTB算法进行降采样，保留数据特征
  const factor = Math.ceil(data.length / threshold);
  const sampled = [];
  
  for (let i = 0; i < data.length; i += factor) {
    // 在每个区间内找到最大和最小值点
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minIndex = i;
    let maxIndex = i;
    
    for (let j = i; j < Math.min(i + factor, data.length); j++) {
      if (data[j].value < minValue) {
        minValue = data[j].value;
        minIndex = j;
      }
      if (data[j].value > maxValue) {
        maxValue = data[j].value;
        maxIndex = j;
      }
    }
    
    // 按原始顺序添加极值点
    if (minIndex <= maxIndex) {
      sampled.push(data[minIndex]);
      if (minIndex !== maxIndex) {
        sampled.push(data[maxIndex]);
      }
    } else {
      sampled.push(data[maxIndex]);
      sampled.push(data[minIndex]);
    }
  }
  
  // 确保包含第一个和最后一个点
  if (sampled[0] !== data[0]) sampled.unshift(data[0]);
  if (sampled[sampled.length - 1] !== data[data.length - 1]) sampled.push(data[data.length - 1]);
  
  return sampled;
}

/**
 * 对序列数据进行处理，包括排序、填补空隙和降采样
 * @param {Object} series - 序列对象
 * @returns {Array} 处理后的数据点数组
 */
export function processSeriesData(series) {
  if (!series || !series.data || series.data.length === 0) {
    return []
  }
  
  // 复制数据进行处理
  let seriesData = [...series.data]
  
  // 确保数据按时间排序
  seriesData.sort((a, b) => a.time - b.time)
  
  // 检查是否有空隙需要填补
  const result = []
  const timeGapThreshold = 0.05 // 认为大于这个值的时间差需要插入过渡点
  
  // 为空数组或单个数据点的情况处理
  if (seriesData.length <= 1) {
    return seriesData
  }
  
  // 检测并填补时间间隔
  for (let i = 0; i < seriesData.length - 1; i++) {
    const current = seriesData[i]
    const next = seriesData[i + 1]
    
    // 确保数据点有效
    if (!current || !next || typeof current.time !== 'number' || typeof next.time !== 'number') {
      continue
    }
    
    result.push(current)
    const gap = next.time - current.time
    
    // 如果时间间隔过大，插入过渡点
    if (gap > timeGapThreshold) {
      // 根据间隔大小决定插入点的数量
      const steps = Math.min(Math.ceil(gap / 0.01), 20) // 最多插入20个点，避免过多
      
      for (let j = 1; j < steps; j++) {
        const ratio = j / steps
        const interpolatedTime = current.time + gap * ratio
        // 线性插值计算值
        const interpolatedValue = current.value + (next.value - current.value) * ratio
        
        result.push({
          time: interpolatedTime,
          value: interpolatedValue
        })
      }
    }
  }
  
  // 添加最后一个点
  result.push(seriesData[seriesData.length - 1])
  
  // 对于大数据集进行降采样
  return result.length > 1000 ? downsampleData(result, 1000) : result
} 