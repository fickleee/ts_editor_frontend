import request from '@/utils/request'

const API = {
  GET_DATA_ORIGINAL_URL: '/data/original',
  GET_DATA_DAY_URL: '/data/day',
  GET_DATA_WEEK_URL: '/data/week',
  GET_DATA_ALL_USER_URL: '/data/allUsers',
  GET_DATA_ALL_USER_WEEK_URL: '/data/allUsers/week',
  GET_DATA_DISTRIBUTION_URL: '/data/distribution',
  GET_DATA_PROJECTION_URL: '/data/projection',
}

export const reqDataOriginal = (dataset) => request.get(API.GET_DATA_ORIGINAL_URL + `?dataset=${dataset}`)  
export const reqDataDay = (dataset) => request.get(API.GET_DATA_DAY_URL + `?dataset=${dataset}`)  
export const reqDataWeek = (dataset) => request.get(API.GET_DATA_WEEK_URL + `?dataset=${dataset}`)
export const reqDataAllUser = (dataset) => request.get(API.GET_DATA_ALL_USER_URL + `?dataset=${dataset}`)  
export const reqDataAllUserWeek = (dataset) => request.get(API.GET_DATA_ALL_USER_WEEK_URL + `?dataset=${dataset}`)  
export const reqDataDistribution = (dataset) => request.get(API.GET_DATA_DISTRIBUTION_URL + `?dataset=${dataset}`)  
export const reqDataProjection = (dataset, model, aggregation) => request.get(API.GET_DATA_PROJECTION_URL + `?dataset=${dataset}&model=${model}&aggregation=${aggregation}`)  