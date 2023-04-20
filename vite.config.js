import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        // minifyInternalExports: true,
        // compact: true,
        manualChunks: {
          // axios: ["axios"],
          // vue: ["vue"],
          // marked: ["marked"],
          // dompurify: ["dompurify"],
          // "@microsoft/fetch-event-source": ["@microsoft/fetch-event-source"],
          "highlight": ["highlight.js"],
        }
      }
    }
  }
})
