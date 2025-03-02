import request from '@/utils/request'

const API = {
  GET_DATA_STEP_URL: '/data/step',
}

export const reqDataStep = () => request.get(API.GET_DATA_STEP_URL)  