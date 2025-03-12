import request from '@/utils/request'

const API = {
  GET_DATA_ORIGINAL_URL: '/data/original',
  GET_DATA_STEP_URL: '/data/step',
  GET_DATA_WEEK_URL: '/data/week',
  GET_DATA_ALL_USER_URL: '/data/allUsers',
  GET_DATA_DISTRIBUTION_URL: '/data/distribution',
  GET_DATA_PROJECTION_URL: '/data/projection',
}

export const reqDataOriginal = (dataset) => request.get(API.GET_DATA_ORIGINAL_URL + `?dataset=${dataset}`)  
export const reqDataStep = () => request.get(API.GET_DATA_STEP_URL)  
export const reqDataWeek = () => request.get(API.GET_DATA_WEEK_URL)
export const reqDataAllUser = (dataset) => request.get(API.GET_DATA_ALL_USER_URL + `?dataset=${dataset}`)  
export const reqDataDistribution = (dataset) => request.get(API.GET_DATA_DISTRIBUTION_URL + `?dataset=${dataset}`)  
export const reqDataProjection = (dataset, model, aggregation) => request.get(API.GET_DATA_PROJECTION_URL + `?dataset=${dataset}&model=${model}&aggregation=${aggregation}`)  