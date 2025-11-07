import { ReframeRequest, ReframeResponse, ImageProvider } from '../types'
import { extractColorPalette } from '../utils/colorExtractor'

// API keys and configuration
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || ''
const DALLE_API_KEY = import.meta.env.VITE_DALLE_API_KEY || ''
const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || ''

// Debug logging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    hasClaudeKey: !!CLAUDE_API_KEY,
    hasDalleKey: !!DALLE_API_KEY,
    hasHuggingFaceKey: !!HUGGINGFACE_API_KEY,
    huggingFaceKeyPrefix: HUGGINGFACE_API_KEY ? HUGGINGFACE_API_KEY.substring(0, 10) + '...' : 'none',
  })
}

// Image generation provider (default: 'pollinations' - free, no API key needed)
const IMAGE_PROVIDER: ImageProvider = (import.meta.env.VITE_IMAGE_PROVIDER as ImageProvider) || 'pollinations'

const LITERARY_FORM_DESCRIPTIONS: Record<string, string> = {
  poem: 'a short poem in the style of Robert Frost or Emily Dickinson',
  sonnet: 'a soliloquy or sonnet in the style of Shakespeare',
  epic: 'a short epic in the style of Homer',
  song: 'a catchy pop song in the style of Taylor Swift',
  fable: 'a short fairytale, fable or myth in the style of old Scottish/Irish/Norse/Greek tales',
  proverb: 'a proverb in the style of Buddhist or African proverbs',
}

export async function generateReframe(request: ReframeRequest): Promise<ReframeResponse> {
  // Generate literary text using Claude API
  const literaryText = await generateLiteraryText(request)
  
  // Generate illustration using selected provider
  const illustrationUrl = await generateIllustration(literaryText, request.literaryForm)
  
  // Extract color palette from illustration if available
  let colorPalette
  if (illustrationUrl) {
    try {
      colorPalette = await extractColorPalette(illustrationUrl)
    } catch (error) {
      console.warn('Failed to extract color palette:', error)
      // Continue without palette - will use default theme
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

  // Try Claude API first if key is available
  if (CLAUDE_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.content[0].text
      }
    } catch (error) {
      console.warn('Claude API error, trying Hugging Face:', error)
    }
  }

  // Fallback to Hugging Face (free tier) if Claude fails or no key
  if (HUGGINGFACE_API_KEY) {
    try {
      console.log('Attempting Hugging Face text generation...')
      const result = await generateWithHuggingFaceText(prompt)
      console.log('Hugging Face text generation successful!')
      return result
    } catch (error) {
      console.error('Hugging Face text generation failed:', error)
      console.warn('Falling back to mock response. Error details:', error instanceof Error ? error.message : error)
    }
  } else {
    console.warn('Hugging Face API key not found in environment variables')
  }

  // Final fallback to mock response
  console.warn('No working API available. Using mock response.')
  console.log('User hypothesis:', request.hypothesis)
  console.log('Literary form:', request.literaryForm)
  return getMockLiteraryText(request.literaryForm, request.hypothesis)
}

async function generateIllustration(literaryText: string, literaryForm: string): Promise<string | undefined> {
  // Create a visual prompt based on the literary text
  const visualPrompt = `Create a beautiful, artistic illustration that captures the essence of this ${literaryForm}: ${literaryText.substring(0, 800)}. The image should be evocative, poetic, and match the tone and style of the text.`

  try {
    switch (IMAGE_PROVIDER) {
      case 'pollinations':
        return await generateWithPollinations(visualPrompt)
      
      case 'dalle':
        if (DALLE_API_KEY) {
          return await generateWithDALLE(visualPrompt)
        }
        console.warn('DALL-E API key not found. Falling back to Pollinations.AI')
        return await generateWithPollinations(visualPrompt)
      
      case 'huggingface':
        if (HUGGINGFACE_API_KEY) {
          return await generateWithHuggingFace(visualPrompt)
        }
        console.warn('Hugging Face API key not found. Falling back to Pollinations.AI')
        return await generateWithPollinations(visualPrompt)
      
      default:
        return await generateWithPollinations(visualPrompt)
    }
  } catch (error) {
    console.error('Error generating illustration:', error)
    // Fallback to free option
    if (IMAGE_PROVIDER !== 'pollinations') {
      try {
        return await generateWithPollinations(visualPrompt)
      } catch (fallbackError) {
        console.error('Fallback image generation also failed:', fallbackError)
        return undefined
      }
    }
    return undefined
  }
}

/**
 * FREE: Pollinations.AI - No API key required!
 * Documentation: https://pollinations.ai/
 */
async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt)
  // Using Flux model for high quality, 1024x1024 resolution
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true`
  return imageUrl
}

/**
 * PAID: DALL-E 3 API (OpenAI)
 * Documentation: https://platform.openai.com/docs/guides/images
 */
async function generateWithDALLE(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DALLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`DALL-E API error: ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  return data.data[0]?.url
}

/**
 * FREE (with API key): Hugging Face Inference API for TEXT generation
 * Get free API key at: https://huggingface.co/settings/tokens
 * Uses Mistral-7B-Instruct for creative text generation
 * 
 * Note: On free tier, models may need to "warm up" on first request (can take 20-30 seconds)
 * Uses Vite proxy to avoid CORS issues
 */
async function generateWithHuggingFaceText(prompt: string): Promise<string> {
  console.log('Calling Hugging Face API with prompt length:', prompt.length)
  
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key is not set')
  }

  // Use Vite proxy to avoid CORS issues
  // The proxy injects the API key server-side for security
  // Using the standard Inference API endpoint format
  const proxyUrl = '/api/huggingface/models/mistralai/Mistral-7B-Instruct-v0.2'
  
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No Authorization header needed - proxy injects it server-side
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        return_full_text: false,
      },
    }),
  })

  console.log('Hugging Face API response status:', response.status)

  // Handle "model is loading" response (common on free tier)
  if (response.status === 503) {
    const errorData = await response.json().catch(() => ({}))
    console.log('Model loading response:', errorData)
    if (errorData.error?.includes('loading') || errorData.estimated_time) {
      const waitTime = errorData.estimated_time || 30
      throw new Error(`Model is loading. Estimated wait time: ${waitTime} seconds. This is normal on free tier. Please try again in a moment.`)
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Hugging Face API error response:', errorText)
    throw new Error(`Hugging Face API error (${response.status}): ${response.statusText} - ${errorText.substring(0, 200)}`)
  }

  const data = await response.json()
  console.log('Hugging Face API response data:', data)
  
  // Handle different response formats
  if (Array.isArray(data) && data[0]?.generated_text) {
    const result = data[0].generated_text.trim()
    console.log('Extracted text from array response, length:', result.length)
    return result
  }
  if (data.generated_text) {
    const result = data.generated_text.trim()
    console.log('Extracted text from object response, length:', result.length)
    return result
  }
  if (typeof data === 'string') {
    console.log('Received string response, length:', data.length)
    return data.trim()
  }
  
  console.error('Unexpected response format:', data)
  throw new Error(`Unexpected response format from Hugging Face API: ${JSON.stringify(data).substring(0, 200)}`)
}

/**
 * FREE (with API key): Hugging Face Inference API for IMAGE generation
 * Get free API key at: https://huggingface.co/settings/tokens
 */
async function generateWithHuggingFace(prompt: string): Promise<string> {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  )

  if (!response.ok) {
    throw new Error(`Hugging Face API error: ${response.statusText}`)
  }

  const blob = await response.blob()
  // Convert blob to data URL for display
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Mock responses for development/testing
function getMockLiteraryText(form: string, hypothesis: string): string {
  const mockTexts: Record<string, string> = {
    poem: `The Sun—a silent Teacher—
Bestows her golden Grade—
Each Beam—a tiny Ladder—
On which the Stems parade—
The Shadow keeps them Humble—
The Light—makes Giants grow—
What Darkness would encumber—
The Noon—will overthrow—`,
    sonnet: `When Phoebus rides his chariot through the sky,
And bathes the earth in golden, warming rays,
The humble seedlings, reaching ever high,
Transform their verdant forms through lengthened days.
For light, that architect of chlorophyll,
Doth whisper secrets to each waiting leaf,
Commands the stem to climb the windowsill,
And grants the stunted plant its tall relief.
But those condemned to dwell in shadow's keep,
Where sunbeams dare not venture, dare not play,
Remain as dwarves while their bright brothers leap
Toward heights unknown in each succeeding day.
Thus nature speaks her truth both clear and bright:
The tallest towers rise toward the light.`,
    epic: `Sing, Muse, of Helios the gold-throned, bearer of life,
Whose radiant fingers stretch across the wine-dark soil,
Where green-armed seedlings, children of Demeter,
Stand in battle-formation, yearning skyward!
See how the Sun-blessed warriors grow mighty,
Their stems like bronze spears piercing heaven's dome,
While shadow-cursed companions, deprived of glory,
Remain as fallen soldiers, forever small, forever waiting.`,
    song: `Started as a seed in the darkest corner
Barely growing, feeling like a foreigner
Then you moved me to the window bay
Now I'm reaching higher every single day

'Cause sunlight, sunlight, makes me grow
Taller than I've ever known
Dancing in your golden glow
That's the only way I know
To rise up, rise up, toward the sky
Sunlight's got me growing high`,
    fable: `Long ago in the emerald hills of Tír na nÓg, two sister-seeds fell from the pouch of a traveling druid. One landed in a sunny meadow where the sun spirits danced from dawn till dusk. The other tumbled into a cave where only shadows dwelt.

The meadow sister grew tall as an oak, her green arms strong enough to embrace the clouds. But the cave sister remained small as a mushroom, pale and wondering.

One day, a wise crow perched between them and cawed: "See how the sun's blessing chooses favorites? She who bathes in light touches the sky, while she who knows only darkness barely knows herself at all."

And so it has been since the world was young—the sun lifts up those who seek her face.`,
    proverb: `The plant that follows the sun's path grows tall enough to shade its children; the one that hides from light remains forever a child itself.`,
  }

  return mockTexts[form] || `Your hypothesis "${hypothesis}" translated into ${form} format.`
}

