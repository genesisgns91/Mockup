import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// "base" só precisa valer para o build de produção (npm run build), que é
// o que vai pro GitHub Pages em https://<usuario>.github.io/Mockup-Almatie/.
// Em desenvolvimento (npm run dev) mantemos a raiz "/", senão o servidor
// local passa a servir em /Mockup-Almatie/ e o preview quebra.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Mockup-Almatie/' : '/',
  plugins: [react()],
}))
