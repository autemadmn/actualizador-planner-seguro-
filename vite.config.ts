import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/excel.prueba/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: "build.html",
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/app.css";
          }
          return "assets/[name][extname]";
        }
      }
    }
  }
}));
