<script setup>
import ProjectionView from './components/ProjectionView.vue';
import EditView from './components/EditView.vue';
import { BORDER_WIDTH, BORDER_COLOR } from './utils/constants';
import MatrixChart from './components/MatrixChart.vue';
import NavBar from './components/NavBar.vue';
import RadialView from './components/RadialView.vue';
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <NavBar />

    <div class="flex flex-1 overflow-hidden">
      <aside class="w-[40%] flex flex-col" 
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
          <!-- 左右结构1:1 -->
          <div class="w-[55%] bg-white" 
              :style="{
                borderRightWidth: `${BORDER_WIDTH}px`,
                borderColor: BORDER_COLOR
              }">
            <RadialView />
          </div>
          <div class="w-[45%] bg-white" 
              :style="{
                borderColor: BORDER_COLOR
              }">
            <ProjectionView />
          </div>
        </div>
      </aside>

      <!-- 右侧区域 - 66.67% -->
      <main class="w-[60%] bg-gray-100 flex flex-col">
        <!-- 上部区域 -->
        <div class="h-full bg-white" 
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

/* 添加全局文字不可选中样式 */
:global(*) {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
</style>