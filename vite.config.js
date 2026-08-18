import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Mockup/', // <-- Nome exato do seu repositório no GitHub
})
