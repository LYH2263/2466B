<template>
  <router-view />
  <CommandPalette ref="commandPaletteRef" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CommandPalette from './components/CommandPalette.vue'
import { useCommandPaletteInit } from './composables/useCommandPaletteInit'
import { useAuth } from './composables/useAuth'

const commandPaletteRef = ref<InstanceType<typeof CommandPalette> | null>(null)
const { initCommandPalette, registerPages, registerActions } = useCommandPaletteInit()
const { isLoggedIn } = useAuth()
const router = useRouter()

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    registerPages()
    registerActions()
  }
})

initCommandPalette()

defineExpose({
  commandPaletteRef,
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style>
