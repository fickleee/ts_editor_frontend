import request from '@/utils/request'

const API = {
  GET_DATA_STEP_URL: '/data/step',
  GET_DATA_ALL_USER_URL: '/data/allUsers',
  GET_DATA_DISTRIBUTION_URL: '/data/distribution',
}

export const reqDataStep = () => request.get(API.GET_DATA_STEP_URL)  
export const reqDataAllUser = (dataset) => request.get(API.GET_DATA_ALL_USER_URL + `?dataset=${dataset}`)  
export const reqDataDistribution = (dataset) => request.get(API.GET_DATA_DISTRIBUTION_URL + `?dataset=${dataset}`)  