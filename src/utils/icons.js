// 自动导入所有 SVG 图标
const modules = import.meta.glob('@/assets/*.svg', { eager: true })

const iconMap = {}

for (const path in modules) {
  const fileName = path.split('/').pop().replace('.svg', '').toLowerCase()
  iconMap[fileName] = modules[path].default
}

export default iconMap