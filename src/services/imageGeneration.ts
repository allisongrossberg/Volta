/**
 * Image Generation Service
 * Uses Pollinations.AI (free, no API key required) for image generation
 */

/**
 * Generate image from text using Pollinations.AI
 */
export async function generateImage(
  text: string,
  _viewportWidth?: number,
  _viewportHeight?: number,
  literaryForm?: string
): Promise<string | null> {
  // NOTE: URL encoding expands text significantly (spaces become %20, newlines %0A, etc.)
  // Pollinations.AI has URL length limits - need to dynamically truncate to ensure URL stays under ~2000 chars
  // Map current form values to original form values
  const formMap: Record<string, string> = {
    'short_poem': 'poem',
    'pop_song': 'song',
    'fairytale': 'fable',
    'sonnet': 'sonnet',
    'epic': 'epic',
    'proverb': 'proverb',
  };
  const originalForm = literaryForm ? (formMap[literaryForm] || literaryForm) : 'text';
  
  // Calculate safe text length to ensure URL stays under limit
  // Based on Pollinations.AI API docs: https://github.com/pollinations/pollinations
  // The endpoint is GET /prompt/{prompt} - URL length is limited by Cloudflare
  // 530 errors occur around 1000+ characters, so we use a conservative limit
  const MAX_URL_LENGTH = 950; // Conservative limit (530 errors at ~1000+, so stay well under)
  const BASE_URL_LENGTH = 95; // Base URL: https://image.pollinations.ai/prompt/?width=1024&height=1024&model=flux&nologo=true (without seed)
  // Enhanced prompt with detailed instructions for impressionist/surrealist style
  // Instructions: impressionist oil painting with expressive brushstrokes and clear subject
  const PROMPT_TEMPLATE = `Impressionist surrealist abstract oil painting of this ${originalForm}: `.length;
  const PROMPT_SUFFIX = `. Vibrant colors, expressive brushstrokes, softened suggestive forms. Visible texture, streaky paint, broken color, loose impressionist style while maintaining clear silhouette of the subject. Clearly recognizable subject with abstract expressionist treatment. Isolated on clean background.`.length;
  const MAX_ENCODED_PROMPT_LENGTH = MAX_URL_LENGTH - BASE_URL_LENGTH;
  
  // Start with a very conservative estimate (encoded text is typically 1.4x original)
  // With 1000 char limit, we have ~850 chars for encoded prompt
  // After template (~150) and suffix (~80), we have ~620 chars for encoded text
  // That's ~440 chars of original text (620/1.4)
  let maxTextLength = Math.floor((MAX_ENCODED_PROMPT_LENGTH - PROMPT_TEMPLATE - PROMPT_SUFFIX) / 1.4);
  maxTextLength = Math.min(maxTextLength, 300); // Cap at 300 chars for safety
  
  // Truncate text to fit
  let textExcerpt = text.substring(0, maxTextLength);
  
  // Build enhanced prompt with detailed instructions for impressionist/surrealist style
  // Instructions help pollinations.ai create expressive oil painting with clear subject
  let visualPrompt = `Impressionist surrealist abstract oil painting of this ${originalForm}: ${textExcerpt}. Vibrant colors, expressive brushstrokes, softened suggestive forms. Visible texture, streaky paint, broken color, loose impressionist style while maintaining clear silhouette of the subject. Clearly recognizable subject with abstract expressionist treatment. Isolated on clean background.`;
  let encodedPrompt = encodeURIComponent(visualPrompt);
  let testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
  
  console.log(`🔍 Initial URL length check: ${testUrlLength} chars (limit: ${MAX_URL_LENGTH}), text excerpt: ${textExcerpt.length} chars`);
  
  // If still too long, reduce text until it fits
  let iterations = 0;
  while (testUrlLength > MAX_URL_LENGTH && textExcerpt.length > 50 && iterations < 20) {
    textExcerpt = text.substring(0, Math.floor(textExcerpt.length * 0.9)); // Reduce by 10%
    visualPrompt = `Impressionist surrealist abstract oil painting of this ${originalForm}: ${textExcerpt}. Vibrant colors, expressive brushstrokes, softened suggestive forms. Visible texture, streaky paint, broken color, loose impressionist style while maintaining clear silhouette of the subject. Clearly recognizable subject with abstract expressionist treatment. Isolated on clean background.`;
    encodedPrompt = encodeURIComponent(visualPrompt);
    testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
    iterations++;
    console.log(`🔍 Iteration ${iterations}: URL length ${testUrlLength} chars, text excerpt: ${textExcerpt.length} chars`);
  }
  
  // Final safety check - if still too long, use minimal text
  if (testUrlLength > MAX_URL_LENGTH) {
    console.warn(`⚠️ URL still too long after truncation (${testUrlLength} > ${MAX_URL_LENGTH}), using minimal text`);
    textExcerpt = text.substring(0, 100); // Fallback to very short excerpt
    visualPrompt = `Impressionist surrealist abstract oil painting of this ${originalForm}: ${textExcerpt}. Vibrant colors, expressive brushstrokes, softened suggestive forms. Visible texture, streaky paint, broken color, loose impressionist style while maintaining clear silhouette of the subject. Clearly recognizable subject with abstract expressionist treatment. Isolated on clean background.`;
  }
  
  console.log(`✅ Final text excerpt: ${textExcerpt.length} chars`);

  try {
    console.log('Generating illustration with Pollinations.AI...');
    return await generateWithPollinations(visualPrompt);
  } catch (error) {
    console.error('Error generating illustration:', error);
    return null;
  }
}

/**
 * FREE: Pollinations.AI - No API key required!
 * Matches original API logic from commit 0b80fee
 * Documentation: https://pollinations.ai/
 */
async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  // NOTE: seed parameter causes 530 errors - removed to fix API calls
  // Using Flux model for high quality, 1024x1024 resolution (matches original)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true`;
  
  // Final safety check - ensure URL is under limit (must match MAX_URL_LENGTH above)
  const MAX_SAFE_URL_LENGTH = 950;
  if (imageUrl.length > MAX_SAFE_URL_LENGTH) {
    console.warn(`⚠️ URL length (${imageUrl.length}) exceeds safe limit (${MAX_SAFE_URL_LENGTH}). This may cause 530 errors.`);
    // This shouldn't happen with the truncation logic above, but log it if it does
  } else {
    console.log(`✅ URL length (${imageUrl.length}) is within safe limit (${MAX_SAFE_URL_LENGTH})`);
  }
  
  return imageUrl;
}
