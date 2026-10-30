import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, version as viteVersion } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function readVersion(path: string): string {
  return JSON.parse(readFileSync(path, 'utf8')).version
}

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null
  } catch {
    return null
  }
}

// No GitHub Actions, APP_VERSION vem do workflow (MAJOR.MINOR do package.json + número da execução).
// Localmente vale a versão do package.json.
const appInfo = {
  version: process.env.APP_VERSION || readVersion('./package.json'),
  buildTime: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || git('rev-parse HEAD'),
  branch: process.env.GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD'),
  repository: process.env.GITHUB_REPOSITORY || null,
  runNumber: process.env.GITHUB_RUN_NUMBER || null,
  dependencies: {
    react: readVersion('./node_modules/react/package.json'),
    supabase: readVersion('./node_modules/@supabase/supabase-js/package.json'),
    vite: viteVersion,
  },
}

export default defineConfig({
  plugins: [
    react(),
    // PWA: manifesto e service worker gerados no build. O caminho base (GitHub Pages) vale para os dois.
    VitePWA({
      // Versão nova é instalada sozinha e vale a partir do próximo carregamento da página.
      registerType: 'autoUpdate',
      // Os ícones já entram pelo globPatterns abaixo; incluí-los de novo só duplica a lista.
      includeManifestIcons: false,
      manifest: {
        name: 'Identity',
        short_name: 'Identity',
        description: 'Carteirinha, disciplinas, secretaria e novidades do seu curso.',
        lang: 'pt-BR',
        // Barra de status do aparelho branca, não na cor primária.
        theme_color: '#ffffff',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só o app (HTML, JS, CSS e ícones) fica em cache. Chamadas ao Supabase sempre vão à rede;
        // offline, as telas usam o que já guardam no localStorage (carteirinha, disciplinas, feed).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_INFO__: JSON.stringify(appInfo),
  },
})
