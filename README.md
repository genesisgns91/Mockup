# Almatiê · Mockup 3D

Editor de mockups 3D de canecas e outros produtos, feito com React + Three.js (react-three-fiber).
Funciona no computador e no celular (a interface vira um "app" em telas pequenas).

Publicado em: https://genesisgns91.github.io/Mockup/ · Site da loja: https://genesisgns91.github.io/Almatie/

## O que ele faz

O site tem **duas ferramentas** (troca no cabeçalho, ou pelo botão de folha na barra do app no celular; o endereço `#gabarito` abre direto o gabarito):

### 1. Mockup 3D

- Escolha do **modelo** 3D (canecas, copos, garrafas etc.), envio da **arte** em uma ou mais áreas, **cores** por parte, **fundo** (cor ou imagem).
- **Exportação** em PNG/JPG/WebP (1×, 2× ou 3×) e vídeo 360°, nos quadros Livre, Quadrado, Retrato, Story e Paisagem.
- Desktop com três tamanhos de visualização (teclas 1, 2 e 3): retangular, quadrado e expandido.
- Salvamento automático no navegador, desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), arrastar ou colar (Ctrl+V) imagens sobre a cena.
- Funciona offline depois da primeira visita (service worker) e pode ser adicionado à tela inicial do celular.

### 2. Gabarito de impressão (sublimação)
- Folhas **A4 e A3**, orientação automática (a que cabe mais), retrato ou paisagem.
- **1 a 6 artes** por folha, sempre centralizadas; a tela mostra quantas cabem na medida escolhida
  (ex.: caneca 210×95 mm → 3 no retrato e 2 na paisagem em A4).
- Medidas padrão (caneca 325/450 ml, chopp, garrafinha, squeeze) + medida **personalizada**.
  As marcadas "aprox." variam entre fabricantes: ajuste em `src/sheet/presets.js` (`verified`).
- **Margem de 0 a 10 mm**, espaço entre artes, encaixe (arte inteira ou preenchendo) e giro de 90°.
- **Espelhar** a arte (sublimação), repetir a mesma arte em todos os espaços.
- Exporta **PDF** (página no tamanho exato da folha) e **PNG** (com o DPI gravado), ambos com
  **fundo transparente** e **300 DPI** (ou 600 DPI). Tudo é gerado no navegador, sem enviar nada a servidores.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes automáticos
npm run build    # gera a pasta dist/
```

O deploy no GitHub Pages é automático a cada push na branch `main` (`.github/workflows/deploy.yml`):
instala, **roda os testes**, faz o build e publica.

## Estrutura

```
index.html                 página base (meta tags de app, manifesto)
icon_A.*                   (opcional) logotipo do topo — na raiz ou em src/assets/
public/                    arquivos servidos como estão
  model*.obj               modelos 3D            thumbnails/   miniaturas do seletor
  manifest.webmanifest     app instalável        sw.js         service worker (offline)
src/
  App.jsx                  estado do projeto, envio de imagens, salvamento, histórico
  config/                  models.js (catálogo), exportFormats.js, links.js
  sheet/                   gabarito de impressão: presets, layout (cálculo), pdf, png,
                           bake/exporter (exportação), SheetStudio/Panes/Preview (telas)
  hooks/                   useIsMobile, useHistory (desfazer/refazer)
  utils/                   exportLayout (encaixe de imagem), imageFiles, persistence
  components/
    ControlsPanel.jsx      painel "Seu mockup" (abas por etapa)
      controls/            ModelPane, ArtPane, ColorsPane, BackgroundPane, Section, ArtSlots…
    Viewport.jsx           quadro da cena, carregamento, erros, arrastar-e-soltar
    MugScene.jsx           canvas 3D
      scene/               Mug, materiais, câmera, captura (PNG/vídeo), teclado…
    MobileShell.jsx        layout de app (celular e modo expandido do desktop)
    StageControls.jsx      seletores de tamanho/quadro e botões de salvar
    ExportPanel.jsx        opções de exportação
tests/                     testes (vitest + jsdom; o de exportação usa um canvas real)
```

## Como adicionar um modelo 3D

1. Coloque o `.obj` em `public/` e a miniatura em `public/thumbnails/<id>.png`.
2. Cadastre em `src/config/models.js` (id, nome, grupo, arquivo, áreas de arte, partes coloridas).
   Para esconder um modelo sem apagá-lo, use `hidden: true`.
3. Rode `npm test`: ele confere se o arquivo e a miniatura existem.

## Observações

- As imagens enviadas ficam **somente no navegador** do usuário (IndexedDB); nada é enviado a servidores.
- Imagens maiores que 4096 px são reduzidas automaticamente para evitar travamentos em celulares.
- Para forçar a atualização do cache offline, aumente `VERSION` em `public/sw.js`.
