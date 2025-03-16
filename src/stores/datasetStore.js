import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDatasetStore = defineStore('dataset', () => {
  const currentDataset = ref('');
  const aggregationLevel = ref('day');
  const selectedVariable = ref('x'); // 添加选中的变量状态

  // 计算属性
  const getCurrentDataset = computed(() => currentDataset.value);

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

  return {
    currentDataset,
    aggregationLevel,
    selectedVariable, // 导出变量状态
    getCurrentDataset,
    setDataset,
    setAggregationLevel,
    setSelectedVariable, // 导出设置变量的方法
  };
}); 