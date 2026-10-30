import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones do app instalado (PWA e apple-touch-icon) a partir de public/logo.png, a arte quadrada da FMU
// com fundo vinho. Rode `npm run generate-pwa-assets` depois de mudar o logo; os PNGs ficam versionados em public/.
// A arte já é quadrada e tem fundo próprio: ocupa o ícone inteiro, sem margem. Em seguida scripts/icons.mjs refaz
// o ícone "maskable" e gera o favicon da aba do navegador, que é o logo vermelho sem fundo (por isso o gerador
// não faz favicon.ico aqui).
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0, favicons: [] },
    maskable: { ...minimal2023Preset.maskable, padding: 0.25, resizeOptions: { background: '#2b0303' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#2b0303' } },
  },
  images: ['public/logo.png'],
})
