import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDatasetStore = defineStore('dataset', () => {
  const currentDataset = ref('');
  const aggregationLevel = ref('day');
  const selectedVariable = ref('x'); // 添加选中的变量状态
  const showWeekday = ref(true); // 添加工作日显示状态
  const showWeekend = ref(true); // 添加周末显示状态
  const selectedUserId = ref(null); // 添加当前选中的用户ID
  const selectedView = ref(null); // 添加当前选中的视图
  const originalData = ref([]); // 添加原始数据状态

  // 计算属性
  const getCurrentDataset = computed(() => currentDataset.value);
  const getShowWeekday = computed(() => showWeekday.value);
  const getShowWeekend = computed(() => showWeekend.value);
  const getSelectedUserId = computed(() => selectedUserId.value);
  const getSelectedView = computed(() => selectedView.value);
  const getOriginalData = computed(() => originalData.value);

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

  // 添加设置选中用户的方法
  function setSelectedUserId(userId) {
    selectedUserId.value = userId;
  }

  function setSelectedView(view) {
    selectedView.value = view;
  }

  // 添加设置原始数据的方法
  function setOriginalData(data) {
    originalData.value = data;
  }

  return {
    currentDataset,
    aggregationLevel,
    selectedVariable,
    showWeekday,
    showWeekend,
    selectedUserId,
    originalData,
    getCurrentDataset,
    getShowWeekday,
    getShowWeekend,
    getSelectedUserId,
    getSelectedView,
    getOriginalData,
    setDataset,
    setAggregationLevel,
    setSelectedVariable,
    setShowWeekday,
    setShowWeekend,
    setSelectedUserId,
    setSelectedView,
    setOriginalData,
  };
}); 