import { createApp } from 'vue'
import './index.css'
// 引入pinia仓库
import pinia from './store'
// 引入element-plus
import ElementPlus from 'element-plus'
import App from './App.vue'

const app = createApp(App)

app.use(pinia)
app.use(ElementPlus)

app.mount('#app')
