// Generate sample house data for 3 days
export function generateHouseData(days = 3) {
  const data = [];
  const minutesPerDay = 24 * 60;
  const samplingInterval = 5; // 5 minutes
  const samplesPerDay = minutesPerDay / samplingInterval;
  
  // Base pattern for a typical house energy consumption
  const basePattern = (hour) => {
    // Morning peak (7-9 AM)
    if (hour >= 7 && hour <= 9) {
      return 7 + Math.random() * 2;
    }
    // Evening peak (18-22)
    if (hour >= 18 && hour <= 22) {
      return 8 + Math.random() * 1.5;
    }
    // Night/early morning (0-6, 23)
    if (hour <= 6 || hour === 23) {
      return 3 + Math.random();
    }
    // Regular daytime
    return 5 + Math.random() * 1.5;
  };

  for (let day = 0; day < days; day++) {
    for (let sample = 0; sample < samplesPerDay; sample++) {
      const timeInMinutes = sample * samplingInterval;
      const hour = timeInMinutes / 60;
      const value = basePattern(hour);
      
      // Add some noise and daily variation
      const noise = Math.random() * 0.5 - 0.25;
      const dailyVariation = Math.sin(day * Math.PI / 2) * 0.5;
      
      data.push({
        time: hour,
        value: Math.max(1, Math.min(10, value + noise + dailyVariation))
      });
    }
  }

  return data;
}