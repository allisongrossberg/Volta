/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLAUDE_API_KEY?: string
  readonly VITE_DALLE_API_KEY?: string
  readonly VITE_HUGGINGFACE_API_KEY?: string
  readonly VITE_IMAGE_PROVIDER?: 'pollinations' | 'dalle' | 'huggingface'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

