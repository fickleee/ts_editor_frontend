// Example

//统一管理咱们项目用户相关的接口
import request from '@/utils/request'

const API = {
  STATION_URL: '/station/detail',
  STATION_DATA_URL: '/station/data',
  STATION_CHART_URL: '/station/chart',
  IMPUTE_URL: '/station/impute',
  REPAIR_URL: '/station/repair',
  SAVE_IMPUTE_URL: '/station/save',
  DECOMPOSE_URL: '/api/decompose',
}

export const reqStationInfo = (
  station_name, start_time, end_time, variable
) =>
  request.get(
    API.STATION_URL +
    `?station_name=${station_name}&start_time=${start_time}&end_time=${end_time}&variable=${variable}`
  )

export const reqStationData = (
  station_name, device_id, start_time, end_time, variable
) =>
  request.get(
    API.STATION_DATA_URL + `?station_name=${station_name}&device_id=${device_id}&start_time=${start_time}&end_time=${end_time}&variable=${variable}`
  )

export const reqStationChart = (
  start_time, station_name, device_id, variable
) =>
  request.get(
    API.STATION_CHART_URL + `?start_time=${start_time}&station_name=${station_name}&device_id=${device_id}&variable=${variable}`
  )


export const reqImpute = (start_time, station_name, device_id, variable) =>
  request.get(
    API.IMPUTE_URL + `?start_time=${start_time}&station_name=${station_name}&device_id=${device_id}&variable=${variable}`
  )
export const reqRepair = (start_time, station_name, device_id, variable) =>
  request.get(
    API.REPAIR_URL + `?start_time=${start_time}&station_name=${station_name}&device_id=${device_id}&variable=${variable}`
  )

export const reqSaveImputeResult = (data) =>
  request.post(API.SAVE_IMPUTE_URL, data)

export const reqRunProcess = (date) => request.get('/preprocess/run-process'+`?process_date=${date}`)

export const reqDecomposeSignal = (date) => 
  request.get(API.DECOMPOSE_URL + `?date=${date}`)
