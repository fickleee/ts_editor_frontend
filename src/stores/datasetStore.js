import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDatasetStore = defineStore('dataset', () => {
  const currentDataset = ref('');
  const aggregationLevel = ref('day');
  const selectedVariable = ref('x'); // 添加选中的变量状态
  const showWeekday = ref(true); // 添加工作日显示状态
  const showWeekend = ref(true); // 添加周末显示状态

  // 计算属性
  const getCurrentDataset = computed(() => currentDataset.value);
  const getShowWeekday = computed(() => showWeekday.value);
  const getShowWeekend = computed(() => showWeekend.value);

  // 方法
  function setDataset(dataset) {
    currentDataset.value = dataset;
  }

  function setAggregationLevel(level) {
    aggregationLevel.value = level;
  }

  // 添加设置选中变量的方法
  function setSelectedVariable(variable) {
    selectedVariable.value = variable;
  }

  // 添加设置工作日/周末显示状态的方法
  function setShowWeekday(show) {
    showWeekday.value = show;
  }

  function setShowWeekend(show) {
    showWeekend.value = show;
  }

  return {
    currentDataset,
    aggregationLevel,
    selectedVariable,
    showWeekday,
    showWeekend,
    getCurrentDataset,
    getShowWeekday,
    getShowWeekend,
    setDataset,
    setAggregationLevel,
    setSelectedVariable,
    setShowWeekday,
    setShowWeekend,
  };
}); 