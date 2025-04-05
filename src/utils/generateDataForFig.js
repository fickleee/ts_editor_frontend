/**
 * 生成一天内每10分钟的时间序列数据，带有移动的峰值和自然波动
 */
export function generateTimeSeriesData(id) {
  const res = [];
  const minutesInDay = 24 * 60;
  const intervalMinutes = 10;
  
  // 设置基准峰值时间（小时）和偏移量
  const basePeakHour = 8; // 基准峰值出现在8:00
  const peakHour = basePeakHour + (id - 1); // 每个ID的峰值往后移动1小时
  const peakMinute = 0;
  const peakTime = peakHour * 60 + peakMinute;
  
  // 控制峰的形状参数
  const amplitude = 0.8; // 峰的高度
  const baseValue = 0.1; // 基础值
  const spread = 90; // 峰的展开程度（分钟）
  
  // 生成一天的随机波动序列（使用正弦函数和随机值的组合）
  const noiseSequence = [];
  const noiseAmplitude = 0.1; // 噪声振幅
  for (let minutes = 0; minutes < minutesInDay; minutes += intervalMinutes) {
    // 生成多个不同频率的正弦波叠加
    const slowNoise = Math.sin(minutes / 720 * Math.PI) * 0.5; // 12小时周期
    const mediumNoise = Math.sin(minutes / 240 * Math.PI) * 0.3; // 4小时周期
    const fastNoise = Math.sin(minutes / 60 * Math.PI) * 0.2; // 1小时周期
    
    // 添加一些随机扰动
    const randomNoise = (Math.random() - 0.5) * 0.4;
    
    // 组合所有噪声
    const totalNoise = (slowNoise + mediumNoise + fastNoise + randomNoise) * noiseAmplitude;
    noiseSequence.push(totalNoise);
  }
  
  // 生成数据点
  for (let i = 0; i < minutesInDay / intervalMinutes; i++) {
    const minutes = i * intervalMinutes;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
    
    // 计算与峰值时间的距离（分钟）
    const distanceFromPeak = Math.abs(minutes - peakTime);
    
    // 使用高斯函数生成基础峰值
    let value = baseValue + amplitude * Math.exp(-(distanceFromPeak * distanceFromPeak) / (2 * spread * spread));
    
    // 添加噪声
    value += noiseSequence[i];
    
    // 确保值在合理范围内
    value = Math.max(0.05, Math.min(0.95, value));
    
    res.push({
      time,
      value
    });
  }
  
  return {
    id,
    res
  };
}

/**
 * 生成5组时间序列数据，每组数据的峰值依次后移1小时
 */
export function generateMultipleTimeSeriesData() {
  // 固定生成5组数据
  return Array.from({ length: 5 }, (_, index) => 
    // generateTimeSeriesData(index + 1)
  generateComplexPatternData(index + 1)
  );
}

/**
 * 生成模拟早晨活动的用电量数据
 */
export function generateMorningActivityData(id) {
  const res = [];
  const minutesInDay = 24 * 60;
  const intervalMinutes = 10;

  // 早晨活动时间范围（8:00-10:00）
  const morningStartHour = 8;
  const morningEndHour = 10;
  const peakHour = morningStartHour + (id - 1) * 0.3; // 每个用户的峰值时间在8:00-9:20之间递增

  // 控制参数
  const morningAmplitude = 0.7; // 早晨活动峰值
  const baseValue = 0.15; // 基础用电量
  const morningSpread = 45; // 早晨峰值的展开程度（分钟）

  // 生成背景噪声序列
  const noiseSequence = [];
  for (let minutes = 0; minutes < minutesInDay; minutes += intervalMinutes) {
    const hour = minutes / 60;
    
    // 根据时间段设置不同的噪声强度
    let noiseAmplitude;
    if (hour >= morningStartHour && hour <= morningEndHour) {
      noiseAmplitude = 0.15; // 早晨时段较大的波动
    } else if (hour >= 18 && hour <= 22) {
      noiseAmplitude = 0.12; // 晚上时段中等波动
    } else {
      noiseAmplitude = 0.08; // 其他时段较小波动
    }

    // 生成多层次噪声
    const slowNoise = Math.sin(minutes / 360 * Math.PI) * 0.4;
    const fastNoise = Math.sin(minutes / 120 * Math.PI) * 0.3;
    const randomNoise = (Math.random() - 0.5) * 0.6;
    
    const totalNoise = (slowNoise + fastNoise + randomNoise) * noiseAmplitude;
    noiseSequence.push(totalNoise);
  }

  // 生成数据点
  for (let i = 0; i < minutesInDay / intervalMinutes; i++) {
    const minutes = i * intervalMinutes;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;

    // 计算早晨活动的基础值
    const peakTimeInMinutes = peakHour * 60;
    const distanceFromPeak = Math.abs(minutes - peakTimeInMinutes);
    let value = baseValue;

    // 在早晨时段添加高峰
    if (hours >= morningStartHour - 1 && hours <= morningEndHour + 1) {
      value += morningAmplitude * Math.exp(-(distanceFromPeak * distanceFromPeak) / (2 * morningSpread * morningSpread));
    }

    // 添加随机波动
    value += noiseSequence[i];

    // 确保值在合理范围内
    value = Math.max(0.1, Math.min(0.9, value));

    res.push({
      time,
      value
    });
  }

  return {
    id,
    res
  };
}

/**
 * 生成5组早晨活动数据
 */
export function generateMultipleMorningData() {
  return Array.from({ length: 5 }, (_, index) => 
    generateMorningActivityData(index + 1)
  );
}

/**
 * 生成复杂的用电模式数据（前三个用户双峰，后两个用户单峰）
 */
export function generateComplexPatternData(id) {
  const res = [];
  const minutesInDay = 24 * 60;
  const intervalMinutes = 10;

  // 时间段设置
  const morningStartHour = 7;
  const morningEndHour = 10;
  const eveningStartHour = 18;
  const eveningEndHour = 22;
  const noonStartHour = 11;
  const noonEndHour = 14;

  // 根据ID确定是双峰还是单峰模式
  const isDoublePeak = id <= 3;

  // 设置峰值时间（错开每个用户的峰值）
  let morningPeakHour, eveningPeakHour, noonPeakHour;
  if (isDoublePeak) {
    // 双峰用户：早晨7:30-8:30之间，晚上18:30-19:30之间
    morningPeakHour = morningStartHour + 0.5 + (id - 1) * 0.5;
    eveningPeakHour = eveningStartHour + 0.5 + (id - 1) * 0.5;
  } else {
    // 单峰用户：中午11:30-13:30之间
    noonPeakHour = noonStartHour + 0.5 + (id - 4) * 1;
  }

  // 控制参数
  const baseValue = 0.12; // 基础用电量
  const peakAmplitude = 0.65; // 峰值高度
  const morningSpread = 60; // 早晨峰值的展开程度（分钟）
  const eveningSpread = 90; // 晚上峰值的展开程度（分钟）
  const noonSpread = 75; // 中午峰值的展开程度（分钟）

  // 生成背景噪声序列
  const noiseSequence = [];
  for (let minutes = 0; minutes < minutesInDay; minutes += intervalMinutes) {
    const hour = minutes / 60;
    
    // 根据时间段设置不同的噪声强度
    let noiseAmplitude;
    if ((hour >= morningStartHour && hour <= morningEndHour) || 
        (hour >= eveningStartHour && hour <= eveningEndHour) ||
        (hour >= noonStartHour && hour <= noonEndHour)) {
      noiseAmplitude = 0.15; // 活动时段较大波动
    } else if (hour >= 23 || hour <= 5) {
      noiseAmplitude = 0.05; // 深夜时段最小波动
    } else {
      noiseAmplitude = 0.08; // 其他时段中等波动
    }

    // 生成多层次噪声
    const slowNoise = Math.sin(minutes / 480 * Math.PI) * 0.4; // 8小时周期
    const mediumNoise = Math.sin(minutes / 240 * Math.PI) * 0.3; // 4小时周期
    const fastNoise = Math.sin(minutes / 60 * Math.PI) * 0.2; // 1小时周期
    const randomNoise = (Math.random() - 0.5) * 0.5;
    
    const totalNoise = (slowNoise + mediumNoise + fastNoise + randomNoise) * noiseAmplitude;
    noiseSequence.push(totalNoise);
  }

  // 生成数据点
  for (let i = 0; i < minutesInDay / intervalMinutes; i++) {
    const minutes = i * intervalMinutes;
    const hours = minutes / 60;
    const time = `${String(Math.floor(hours)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

    let value = baseValue;

    if (isDoublePeak) {
      // 双峰模式：早晨和晚上各有一个峰值
      const morningDistance = Math.abs(hours - morningPeakHour);
      const eveningDistance = Math.abs(hours - eveningPeakHour);
      
      // 添加早晨峰值
      value += peakAmplitude * Math.exp(-(morningDistance * morningDistance * 3600) / (2 * morningSpread * morningSpread));
      // 添加晚上峰值
      value += peakAmplitude * 0.9 * Math.exp(-(eveningDistance * eveningDistance * 3600) / (2 * eveningSpread * eveningSpread));
    } else {
      // 单峰模式：中午有一个峰值
      const noonDistance = Math.abs(hours - noonPeakHour);
      value += peakAmplitude * 1.1 * Math.exp(-(noonDistance * noonDistance * 3600) / (2 * noonSpread * noonSpread));
    }

    // 添加随机波动
    value += noiseSequence[i];

    // 确保值在合理范围内
    value = Math.max(0.08, Math.min(0.92, value));

    res.push({
      time,
      value
    });
  }

  return {
    id,
    res
  };
}

/**
 * 生成5组复杂模式数据（前3个双峰，后2个单峰）
 */
export function generateMultipleComplexData() {
  return Array.from({ length: 5 }, (_, index) => 
    generateComplexPatternData(index + 1)
  );
}
