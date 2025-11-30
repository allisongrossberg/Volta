/**
 * Image Generation Service
 * Uses Pollinations.AI (free, no API key required) for image generation
 */

/**
 * Generate a deterministic seed from a string (simple hash function)
 * This ensures the same prompt always gets the same seed for consistency
 */
function generateSeedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return a positive integer seed (0 to 2^31-1)
  return Math.abs(hash);
}

/**
 * Generate image from text using Pollinations.AI
 */
export async function generateImage(
  text: string,
  _viewportWidth?: number,
  _viewportHeight?: number,
  _literaryForm?: string
): Promise<string | null> {
  // NOTE: URL encoding expands text significantly (spaces become %20, newlines %0A, etc.)
  // Pollinations.AI has URL length limits - need to dynamically truncate to ensure URL stays under ~2000 chars
  // Map current form values to original form values
  
  // Calculate safe text length to ensure URL stays under limit
  // Based on Pollinations.AI API docs: https://github.com/pollinations/pollinations
  // The endpoint is GET /prompt/{prompt} - URL length is limited by HTTP GET standards
  // URL format: https://image.pollinations.ai/prompt/{encodedPrompt}?width={width}&height={height}&model={model}&seed={seed}&nologo=true
  // URL length limits:
  // - HTTP GET URLs can theoretically be up to 2000-2048 characters
  // - Testing shows Pollinations.AI works with URLs up to at least 5000 characters
  // - Base URL: https://image.pollinations.ai/prompt/?width=3072&height=3072&model=flux&nologo=true = 87 chars
  const MAX_URL_LENGTH = 5000; // Increased limit based on testing - allows for longer prompts
  const BASE_URL_WITHOUT_SEED = 87; // Base URL without seed: https://image.pollinations.ai/prompt/?width=3072&height=3072&model=flux&nologo=true
  // Fine art style - put FIRST to prioritize fine art aesthetics over literal content
  // Emphasize gallery-quality abstract art with sophisticated color palettes
  const STYLE_PREFIX = `Fine art abstract painting, gallery-quality contemporary art, minimalist composition, sophisticated color palette, dark background, museum-worthy artwork, inspired by: `;
  const STYLE_SUFFIX = `. Pure abstraction, refined aesthetic, color harmony, emotional resonance, fine art quality.`;
  
  // Negative prompt to exclude inappropriate content
  // Pollinations.AI supports negative parameter to exclude unwanted elements
  const NEGATIVE_PROMPT = `children, creepy, inappropriate, disturbing, offensive, explicit, violent, gore, horror, scary, unsettling`;
  
  // Helper function to calculate exact URL length including seed and negative prompt
  const calculateUrlLength = (prompt: string, negativePrompt: string): number => {
    const encodedPrompt = encodeURIComponent(prompt);
    const encodedNegative = encodeURIComponent(negativePrompt);
    const seed = generateSeedFromString(prompt);
    const seedParamLength = `&seed=${seed}`.length;
    const negativeParamLength = `&negative=${encodedNegative}`.length;
    return BASE_URL_WITHOUT_SEED + seedParamLength + negativeParamLength + encodedPrompt.length;
  };
  
  // Start with a conservative estimate (encoded text is typically 1.4x original)
  // Account for seed parameter (~15 chars) and negative prompt parameter in our estimate
  // With 5000 char limit, we can send much more of the literary text
  const ESTIMATED_SEED_LENGTH = 15;
  const encodedNegativeLength = encodeURIComponent(NEGATIVE_PROMPT).length;
  const ESTIMATED_NEGATIVE_PARAM_LENGTH = `&negative=`.length + encodedNegativeLength;
  const MAX_ENCODED_PROMPT_LENGTH = MAX_URL_LENGTH - BASE_URL_WITHOUT_SEED - ESTIMATED_SEED_LENGTH - ESTIMATED_NEGATIVE_PARAM_LENGTH;
  // Prompt structure: style prefix + text excerpt + style suffix
  const STYLE_PREFIX_LENGTH = STYLE_PREFIX.length;
  const STYLE_SUFFIX_LENGTH = STYLE_SUFFIX.length;
  const TOTAL_STYLE_LENGTH = STYLE_PREFIX_LENGTH + STYLE_SUFFIX_LENGTH;
  let maxTextLength = Math.floor((MAX_ENCODED_PROMPT_LENGTH - TOTAL_STYLE_LENGTH - 10) / 1.4); // -10 for separator and buffer
  maxTextLength = Math.min(maxTextLength, 3000); // Cap at 3000 chars to leave room for style modifiers
  
  // Truncate text to fit
  let textExcerpt = text.substring(0, maxTextLength);
  
  // Build prompt: style prefix FIRST (to prioritize fine art aesthetics), then text, then style suffix
  // This structure ensures the model understands we want fine art abstraction, not literal representation
  let visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
  let testUrlLength = calculateUrlLength(visualPrompt, NEGATIVE_PROMPT);
  
  console.log(`🔍 Initial URL length check: ${testUrlLength} chars (limit: ${MAX_URL_LENGTH}), text excerpt: ${textExcerpt.length} chars`);
  
  // If still too long, reduce text until it fits
  let iterations = 0;
  while (testUrlLength > MAX_URL_LENGTH && textExcerpt.length > 50 && iterations < 20) {
    textExcerpt = text.substring(0, Math.floor(textExcerpt.length * 0.9)); // Reduce by 10%
    visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
    testUrlLength = calculateUrlLength(visualPrompt, NEGATIVE_PROMPT);
    iterations++;
    console.log(`🔍 Iteration ${iterations}: URL length ${testUrlLength} chars, text excerpt: ${textExcerpt.length} chars`);
  }
  
  // Final safety check - if still too long, use minimal text
  if (testUrlLength > MAX_URL_LENGTH) {
    console.warn(`⚠️ URL still too long after truncation (${testUrlLength} > ${MAX_URL_LENGTH}), using minimal text`);
    textExcerpt = text.substring(0, 100); // Fallback to very short excerpt
    visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
    testUrlLength = calculateUrlLength(visualPrompt, NEGATIVE_PROMPT);
  }
  
  console.log(`✅ Final text excerpt: ${textExcerpt.length} chars`);
  console.log(`📝 Full prompt being sent (first 500 chars): ${visualPrompt.substring(0, 500)}...`);
  console.log(`📝 Full prompt length: ${visualPrompt.length} chars`);

  try {
    console.log('Generating illustration with Pollinations.AI...');
    return await generateWithPollinations(visualPrompt, NEGATIVE_PROMPT);
  } catch (error) {
    console.error('Error generating illustration:', error);
    return null;
  }
}

/**
 * FREE: Pollinations.AI - No API key required!
 * Documentation: https://pollinations.ai/
 * GitHub: https://github.com/pollinations/pollinations
 * 
 * URL Format: https://image.pollinations.ai/prompt/{encodedPrompt}?width={width}&height={height}&model={model}&seed={seed}&negative={negative}&nologo=true
 * 
 * Rate Limits (per IP):
 * - Anonymous: 1 concurrent request (or 1 per 18 seconds)
 * - Seed: 3 concurrent requests
 * - Flower: 7 concurrent requests  
 * - Nectar: 50 concurrent requests
 * 
 * Note: Images are generated on-demand, so they may not be immediately available.
 * Retry logic with exponential backoff is recommended for handling transient errors.
 */
async function generateWithPollinations(prompt: string, negativePrompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const encodedNegative = encodeURIComponent(negativePrompt);
  
  // Generate a deterministic seed from the prompt for consistency
  // Same prompt = same seed = same image (useful for caching/reproducibility)
  const seed = generateSeedFromString(prompt);
  
  // Using Flux model for high quality, 3072x3072 resolution with seed for ultra high-resolution output
  // Higher resolution ensures quality on detail page, gallery will resize appropriately
  // URL format matches Pollinations.AI documentation: /prompt/{prompt}?width={w}&height={h}&model={m}&seed={s}&negative={n}&nologo=true
  // Negative prompt excludes inappropriate content (children, creepy, etc.)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=3072&height=3072&model=flux&seed=${seed}&negative=${encodedNegative}&nologo=true`;
  
  console.log(`🎲 Using seed: ${seed} for prompt (first 50 chars): ${prompt.substring(0, 50)}...`);
  console.log(`🚫 Negative prompt: ${negativePrompt.substring(0, 80)}...`);
  
  // Final safety check - ensure URL is under limit (must match MAX_URL_LENGTH above)
  // Note: seed and negative prompt add to URL length, so we account for that
  const MAX_SAFE_URL_LENGTH = 5000;
  if (imageUrl.length > MAX_SAFE_URL_LENGTH) {
    console.warn(`⚠️ URL length (${imageUrl.length}) exceeds safe limit (${MAX_SAFE_URL_LENGTH}). This may cause issues.`);
    // This shouldn't happen with the truncation logic above, but log it if it does
  } else {
    console.log(`✅ URL length (${imageUrl.length}) is within safe limit (${MAX_SAFE_URL_LENGTH})`);
  }
  
  // Note: We don't verify the URL here because Pollinations.AI generates images on-demand
  // The image might not be ready immediately, so verification would fail
  // Instead, we rely on retry logic in the preload/load handlers
  
  return imageUrl;
}
