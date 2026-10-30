/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Dados do build, definidos em vite.config.ts.
declare const __APP_INFO__: {
  version: string
  buildTime: string
  commit: string | null
  branch: string | null
  repository: string | null
  runNumber: string | null
  dependencies: { react: string, supabase: string, vite: string }
}
