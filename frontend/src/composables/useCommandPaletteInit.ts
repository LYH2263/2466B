import { onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useCommandRegistry } from './useCommandRegistry'
import { useAuth } from './useAuth'
import { useAssets } from './useAssets'
import { useTransactions } from './useTransactions'
import { useNotifications } from './useNotifications'

export function useCommandPaletteInit() {
  const { registerAction, registerPage } = useCommandRegistry()
  const { clearUser, isAdmin } = useAuth()
  const { fillDemoData } = useAssets()
  const { fillDemoTransactions } = useTransactions()
  const { fetchNotifications } = useNotifications()
  const router = useRouter()

  function registerPages() {
    registerPage({
      id: 'page-dashboard',
      title: '仪表盘',
      subtitle: '查看资产概览和统计图表',
      path: '/',
      keywords: ['dashboard', 'home', '首页', '概览', '资产', '统计', '图表'],
      icon: 'DataAnalysis',
    })

    registerPage({
      id: 'page-transactions',
      title: '交易记录',
      subtitle: '管理收入和支出记录',
      path: '/transactions',
      keywords: ['transactions', '交易', '收支', '收入', '支出', '转账', '流水'],
      icon: 'List',
    })

    registerPage({
      id: 'page-reports',
      title: '报告中心',
      subtitle: '生成和查看财务报告',
      path: '/reports',
      keywords: ['reports', '报告', '报表', '分析', '数据'],
      icon: 'Document',
    })

    if (isAdmin.value) {
      registerPage({
        id: 'page-admin',
        title: '管理面板',
        subtitle: '用户管理和系统设置',
        path: '/admin',
        keywords: ['admin', '管理', '设置', '用户', '系统'],
        icon: 'Setting',
      })
    }
  }

  function registerActions() {
    registerAction({
      id: 'action-add-asset',
      title: '新增资产记录',
      subtitle: '快速添加一条资产记录',
      keywords: ['add', 'new', 'create', '新增', '添加', '资产', '记录'],
      icon: 'Plus',
      showInPalette: true,
      action: async () => {
        ElMessage.info('请在仪表盘页面使用资产表单添加记录')
        router.push('/')
      },
    })

    registerAction({
      id: 'action-add-transaction',
      title: '新增交易记录',
      subtitle: '快速添加一条交易记录',
      keywords: ['add', 'new', 'create', '新增', '添加', '交易', '收支', '收入', '支出'],
      icon: 'Plus',
      showInPalette: true,
      action: async () => {
        ElMessage.info('请在交易记录页面使用交易表单添加记录')
        router.push('/transactions')
      },
    })

    registerAction({
      id: 'action-fill-demo-assets',
      title: '填充资产示例数据',
      subtitle: '快速生成6个月的资产记录',
      keywords: ['demo', 'sample', 'fill', '填充', '示例', '测试', '资产'],
      icon: 'MagicStick',
      showInPalette: true,
      action: async () => {
        try {
          await ElMessageBox.confirm(
            '确定要填充资产示例数据吗？这将添加6条资产记录。',
            '确认操作',
            {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'warning',
            }
          )
          await fillDemoData()
          ElMessage.success('资产示例数据填充成功')
          router.push('/')
        } catch {
          ElMessage.info('已取消操作')
        }
      },
    })

    registerAction({
      id: 'action-fill-demo-transactions',
      title: '填充交易示例数据',
      subtitle: '快速生成多个月的交易记录',
      keywords: ['demo', 'sample', 'fill', '填充', '示例', '测试', '交易'],
      icon: 'MagicStick',
      showInPalette: true,
      action: async () => {
        try {
          await ElMessageBox.confirm(
            '确定要填充交易示例数据吗？这将添加20条交易记录。',
            '确认操作',
            {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'warning',
            }
          )
          await fillDemoTransactions()
          ElMessage.success('交易示例数据填充成功')
          router.push('/transactions')
        } catch {
          ElMessage.info('已取消操作')
        }
      },
    })

    registerAction({
      id: 'action-refresh-notifications',
      title: '刷新通知',
      subtitle: '获取最新的系统通知',
      keywords: ['refresh', 'reload', 'notification', '刷新', '通知', '消息'],
      icon: 'Refresh',
      showInPalette: true,
      action: async () => {
        try {
          await fetchNotifications()
          ElMessage.success('通知已刷新')
        } catch {
          ElMessage.error('刷新通知失败')
        }
      },
    })

    registerAction({
      id: 'action-logout',
      title: '退出登录',
      subtitle: '安全退出当前账户',
      keywords: ['logout', 'signout', 'exit', '退出', '登出', '注销'],
      icon: 'SwitchButton',
      showInPalette: true,
      action: async () => {
        try {
          await ElMessageBox.confirm('确定要退出登录吗？', '确认退出', {
            confirmButtonText: '退出',
            cancelButtonText: '取消',
            type: 'warning',
          })
          clearUser()
          ElMessage.success('已退出登录')
          router.push('/login')
        } catch {
          ElMessage.info('已取消操作')
        }
      },
    })

    registerAction({
      id: 'action-go-to-dashboard',
      title: '跳转到仪表盘',
      subtitle: '快速返回首页',
      keywords: ['go', 'navigate', '跳转', '导航', '首页', '仪表盘'],
      icon: 'House',
      showInPalette: true,
      action: () => {
        router.push('/')
      },
    })

    registerAction({
      id: 'action-go-to-transactions',
      title: '跳转到交易记录',
      subtitle: '查看所有交易记录',
      keywords: ['go', 'navigate', '跳转', '导航', '交易', '收支'],
      icon: 'List',
      showInPalette: true,
      action: () => {
        router.push('/transactions')
      },
    })

    registerAction({
      id: 'action-go-to-reports',
      title: '跳转到报告中心',
      subtitle: '生成财务报告',
      keywords: ['go', 'navigate', '跳转', '导航', '报告', '报表'],
      icon: 'Document',
      showInPalette: true,
      action: () => {
        router.push('/reports')
      },
    })
  }

  function initCommandPalette() {
    onMounted(() => {
      registerPages()
      registerActions()
    })
  }

  return {
    initCommandPalette,
    registerPages,
    registerActions,
  }
}
