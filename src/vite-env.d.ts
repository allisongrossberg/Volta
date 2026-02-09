/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUGGINGFACE_API_KEY?: string
  readonly VITE_POLLINATIONS_API_KEY?: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
