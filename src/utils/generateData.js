// Generate sample house data with values in the 0-150 range
export function generateHouseData(days = 3) {
  const data = [];
  const minutesPerDay = 24 * 60;
  const samplingInterval = 5; // 5 minutes
  const samplesPerDay = minutesPerDay / samplingInterval;
  
  // Base pattern for a typical consumption with values in 0-150 range
  const basePattern = (hour) => {
    // Morning peak (7-9 AM)
    if (hour >= 7 && hour <= 9) {
      return 100 + Math.random() * 30;
    }
    // Evening peak (18-22)
    if (hour >= 18 && hour <= 22) {
      return 120 + Math.random() * 25;
    }
    // Night/early morning (0-6, 23)
    if (hour <= 6 || hour === 23) {
      return 40 + Math.random() * 20;
    }
    // Regular daytime
    return 70 + Math.random() * 30;
  };

  for (let day = 0; day < days; day++) {
    for (let sample = 0; sample < samplesPerDay; sample++) {
      const timeInMinutes = sample * samplingInterval;
      const hour = timeInMinutes / 60;
      const value = basePattern(hour);
      
      // Add some noise and daily variation
      const noise = Math.random() * 10 - 5;
      const dailyVariation = Math.sin(day * Math.PI / 2) * 10;
      
      data.push({
        time: hour,
        value: Math.max(5, Math.min(150, value + noise + dailyVariation))
      });
    }
  }

  return data;
}