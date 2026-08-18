import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mug-mockup-3d/', // <-- Adicione esta linha com o nome do seu repositório
})