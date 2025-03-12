import axios from 'axios'

const API_URL = 'http://localhost:1022/api'

export const api = {
  async importData(date) {
    const response = await axios.get(`${API_URL}/data/import`, {
      params: { date }
    })
    return response.data
  },

  async decomposeSeries(data, options) {
    const response = await axios.post(`${API_URL}/decompose`, {
      data,
      options
    })
    return response.data
  }
}