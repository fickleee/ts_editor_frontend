import { defineStore } from 'pinia';

export const useDatasetStore = defineStore('dataset', {
  state: () => ({
    currentDataset: '',
  }),
  
  actions: {
    setDataset(dataset) {
      this.currentDataset = dataset;
    },
  },
  
  getters: {
    getCurrentDataset: (state) => state.currentDataset,
  },
}); 