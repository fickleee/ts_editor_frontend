<script setup>
import ProjectionView from './components/ProjectionView.vue';
import EditView from './components/EditView.vue';
import { BORDER_WIDTH, BORDER_COLOR } from './utils/constants';
import MatrixChart from './components/MatrixChart.vue';
import NavBar from './components/NavBar.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />

    <div class="flex flex-1">
      <aside class="w-[33.33%] flex flex-col" 
            :style="{
              borderRightWidth: `${BORDER_WIDTH}px`,
              borderColor: BORDER_COLOR
            }">
        <div class="flex-1 bg-white" 
            :style="{
              borderBottomWidth: `${BORDER_WIDTH}px`,
              borderColor: BORDER_COLOR
            }">
          <MatrixChart />
        </div>
        <div class="flex flex-1">
          <div class="w-[100%] bg-white" 
              :style="{
                borderColor: BORDER_COLOR
              }">
            <ProjectionView />
          </div>
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