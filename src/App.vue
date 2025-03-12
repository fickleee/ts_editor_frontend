<script setup>
import RadialView from './components/RadialView.vue';
import ProjectionView from './components/ProjectionView.vue';
import DetailView from './components/DetailView.vue';
import EditView from './components/EditView.vue';
import { BORDER_WIDTH, BORDER_COLOR } from './utils/constants';
import MatrixView from './components/MatrixView.vue';
import MatrixChart from './components/MatrixChart.vue';
import NavBar from './components/NavBar.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 导航栏 -->
    <!-- <nav class="h-[6.0vh] bg-white shadow-md flex items-center px-4" 
        :style="{
          borderBottomWidth: `${BORDER_WIDTH}px`,
          borderColor: BORDER_COLOR
        }">
      <img 
        src="./assets/TimeSeries Editor.svg" 
        alt="Time Series Editor" 
        class="h-[2vh] w-auto"
      />
    </nav> -->
    <NavBar />

    <!-- 左右布局 -->
    <div class="flex flex-1">
      <!-- 左侧区域 - 33.33% -->
      <aside class="w-[33.33%] flex flex-col" 
            :style="{
              borderRightWidth: `${BORDER_WIDTH}px`,
              borderColor: BORDER_COLOR
            }">
        <!-- 上部区域 -->
        <div class="flex-1 bg-white" 
            :style="{
              borderBottomWidth: `${BORDER_WIDTH}px`,
              borderColor: BORDER_COLOR
            }">
          <MatrixChart />
        </div>
        <!-- 下部区域 - 左右布局 -->
        <div class="flex flex-1">
          <!-- 左侧下部 - 1.7 -->
          <div class="w-[100%] bg-white" 
              :style="{
                // borderRightWidth: `${BORDER_WIDTH}px`,
                borderColor: BORDER_COLOR
              }">
            <ProjectionView />
          </div>
          <!-- 右侧下部 - 1 -->
          <!-- <div class="w-[36.36%] bg-white">
            <DetailView />
          </div> -->
        </div>
      </aside>

      <!-- 右侧区域 - 66.67% -->
      <main class="w-[66.67%] bg-gray-100 flex flex-col">
        <!-- 上部区域 -->
        <div class="flex-1 bg-white" 
            :style="{
              // borderBottomWidth: `${BORDER_WIDTH}px`,
              borderColor: BORDER_COLOR
            }">
          <EditView />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
[style*="border"] {
  border-style: solid;
}
</style>