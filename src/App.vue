<script setup>
import SignalDecomposition from './components/SignalDecomposition.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 导航栏 -->
    <nav class="h-[3.7vh] bg-gray-800 text-white flex items-center px-4">
      <div>导航栏</div>
    </nav>

    <!-- 三栏布局 -->
    <div class="flex flex-1">
      <!-- 左侧边栏 - 20% -->
      <aside class="w-[20%] bg-gray-100 p-4">
        左侧栏
      </aside>

      <!-- 主内容区 - 60% -->
      <main class="w-[60%] bg-white p-4">
        <SignalDecomposition />
      </main>

      <!-- 右侧边栏 - 20% -->
      <aside class="w-[20%] bg-gray-100 p-4">
        右侧栏
      </aside>
    </div>
  </div>
</template>

<style scoped>
</style>
