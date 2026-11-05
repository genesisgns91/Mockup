/*
  ==========================================================
  FORMATOS DE EXPORTAÇÃO

  "free" mantém o comportamento original (tamanho do
  viewport). Os demais recortam a imagem/vídeo final para
  encaixar perfeitamente nas redes sociais, em alta
  qualidade (1080px no lado maior).
  ==========================================================
*/
export const EXPORT_FORMATS = [
  {
    id: 'free',
    label: 'Livre',
    hint: 'Tamanho original',
    width: null,
    height: null,
  },
  {
    id: 'square',
    label: 'Quadrado',
    hint: '1080×1080 · Feed',
    width: 1080,
    height: 1080,
  },
  {
    id: 'portrait',
    label: 'Retrato',
    hint: '1080×1350 · Feed',
    width: 1080,
    height: 1350,
  },
  {
    id: 'story',
    label: 'Story',
    hint: '1080×1920 · Stories/Reels/TikTok',
    width: 1080,
    height: 1920,
  },
  {
    id: 'wide',
    label: 'Paisagem',
    hint: '1920×1080 · 16:9',
    width: 1920,
    height: 1080,
  },
]
