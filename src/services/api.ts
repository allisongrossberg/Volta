import { ReframeRequest, ReframeResponse } from '../types'
import { extractColorPalette } from '../utils/colorExtractor'

// API key
const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || ''

// Debug logging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    hasHuggingFaceKey: !!HUGGINGFACE_API_KEY,
    huggingFaceKeyPrefix: HUGGINGFACE_API_KEY ? HUGGINGFACE_API_KEY.substring(0, 10) + '...' : 'none',
  })
}

const LITERARY_FORM_DESCRIPTIONS: Record<string, string> = {
  poem: 'a short poem in the style of Robert Frost or Emily Dickinson',
  sonnet: 'a soliloquy or sonnet in the style of Shakespeare',
  epic: 'a short epic in the style of Homer',
  song: 'a catchy pop song in the style of Taylor Swift',
  fable: 'a short fairytale, fable or myth in the style of old Scottish/Irish/Norse/Greek tales',
  proverb: 'a proverb in the style of Buddhist or African proverbs',
}

export async function generateReframe(request: ReframeRequest): Promise<ReframeResponse> {
  // Generate literary text using Hugging Face
  const literaryText = await generateLiteraryText(request)
  
  // Generate illustration using Pollinations.AI
  const illustrationUrl = await generateIllustration(literaryText, request.literaryForm)
  
  // Extract color palette from illustration
  let colorPalette
  if (illustrationUrl) {
    try {
      colorPalette = await extractColorPalette(illustrationUrl)
    } catch (error) {
      console.warn('Failed to extract color palette:', error)
    }
  }

  return {
    literaryText,
    illustrationUrl,
    colorPalette,
  }
}

async function generateLiteraryText(request: ReframeRequest): Promise<string> {
  const formDescription = LITERARY_FORM_DESCRIPTIONS[request.literaryForm] || request.literaryForm
  
  const prompt = `Translate the following scientific hypothesis into ${formDescription}. 
The translation should be accurate but creative, literary but joyous, clear and thought-provoking.

Hypothesis: ${request.hypothesis}

Please provide only the literary translation, without any additional commentary or explanation.`

  // Check for API key first
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key not found. Please add VITE_HUGGINGFACE_API_KEY to your .env file.')
  }

  // Generate with Hugging Face - will throw error if it fails
  console.log('Generating literary text with Hugging Face...')
  const result = await generateWithHuggingFaceText(prompt)
  console.log('✅ Text generation successful!')
  return result
}

async function generateIllustration(literaryText: string, literaryForm: string): Promise<string | undefined> {
  const visualPrompt = `Create a beautiful, artistic illustration that captures the essence of this ${literaryForm}: ${literaryText.substring(0, 800)}. The image should be evocative, poetic, and match the tone and style of the text.`

  try {
    console.log('Generating illustration with Pollinations.AI...')
    return await generateWithPollinations(visualPrompt)
  } catch (error) {
    console.error('Error generating illustration:', error)
    return undefined
  }
}

/**
 * FREE: Pollinations.AI - No API key required!
 * Documentation: https://pollinations.ai/
 */
async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt)
  // Add random seed for unique images each time
  const seed = Math.floor(Math.random() * 1000000)
  // Using Flux model for high quality, 1024x1024 resolution
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`
  return imageUrl
}

/**
 * FREE (with API key): Hugging Face Inference API for TEXT generation
 * Get free API key at: https://huggingface.co/settings/tokens
 * Uses Hugging Face's OpenAI-compatible router endpoint
 */
async function generateWithHuggingFaceText(prompt: string): Promise<string> {
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key is not set')
  }

  // Try multiple models in order of preference
  const models = [
    "openai/gpt-oss-20b",
    "google/flan-t5-large",
    "mosaicml/mpt-7b-storywriter",
    'meta-llama/Llama-3.2-3B-Instruct',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'meta-llama/Llama-3.1-8B-Instruct',
    'mistralai/Mistral-7B-Instruct-v0.3',
    'microsoft/Phi-3.5-mini-instruct',
  ]
  
  let lastError: Error | null = null
  
  for (const modelName of models) {
    try {
      console.log(`Trying model: ${modelName}`)
      
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9,
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      
      if (data.choices && data.choices[0]?.message?.content) {
        const generatedText = data.choices[0].message.content.trim()
        console.log(`✅ Success with model: ${modelName}`)
        return generatedText
      }
      
      throw new Error('Unexpected response format')
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  
  // If all models failed, throw the last error
  throw lastError || new Error('All models failed')
}


