import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera favicon, ícones do PWA, ícone "maskable" (Android) e apple-touch-icon a partir de public/logo.svg.
// Rode `npm run generate-pwa-assets` depois de mudar o logo; os PNGs ficam versionados em public/.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#ea1f25' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#ea1f25' } },
  },
  images: ['public/logo.svg'],
})
