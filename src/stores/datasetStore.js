import { defineStore } from 'pinia';

export const useDatasetStore = defineStore('dataset', {
  state: () => ({
    currentDataset: null,
    aggregationLevel: 'day', // 默认聚合方式
  }),
  
  actions: {
    setDataset(dataset) {
      this.currentDataset = dataset;
    },
    setAggregationLevel(level) {
      this.aggregationLevel = level;
    },
  },
  
  getters: {
    getCurrentDataset: (state) => state.currentDataset,
    getAggregationLevel: (state) => state.aggregationLevel,
  },
}); 