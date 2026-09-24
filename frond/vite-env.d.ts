/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL complète du backend quand il est déployé séparément (Vercel).
   *  Laisser vide si front et back sont servis par le même serveur (Railway). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
