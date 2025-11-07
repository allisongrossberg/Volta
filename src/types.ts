export type LiteraryForm = 
  | 'poem'
  | 'sonnet'
  | 'epic'
  | 'song'
  | 'fable'
  | 'proverb'

export type ImageProvider = 'pollinations' | 'dalle' | 'midjourney' | 'huggingface'

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  text: string
  background: string
}

export interface ReframeRequest {
  hypothesis: string
  literaryForm: LiteraryForm
}

export interface ReframeResponse {
  literaryText: string
  illustrationUrl?: string
  colorPalette?: ColorPalette
}

