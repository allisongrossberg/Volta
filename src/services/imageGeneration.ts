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
  // URL length limits:
  // - HTTP GET URLs can theoretically be up to 2000-2048 characters
  // - Testing shows Pollinations.AI works with URLs up to at least 5000 characters
  // - Base URL: https://image.pollinations.ai/prompt/?width=2048&height=2048&model=flux&nologo=true = 87 chars
  const MAX_URL_LENGTH = 5000; // Increased limit based on testing - allows for longer prompts
  const BASE_URL_WITHOUT_SEED = 87; // Base URL without seed: https://image.pollinations.ai/prompt/?width=2048&height=2048&model=flux&nologo=true
  // Abstract art style - put FIRST to prioritize abstraction over literal content
  // Use strong modifiers to ensure abstract interpretation, not representational art
  const STYLE_PREFIX = `Abstract contemporary art, non-representational, geometric forms, color fields, expressive brushstrokes, inspired by: `;
  const STYLE_SUFFIX = `. Pure abstraction, color, form, and emotion only.`;
  
  // Helper function to calculate exact URL length including seed
  const calculateUrlLength = (prompt: string): number => {
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = generateSeedFromString(prompt);
    const seedParamLength = `&seed=${seed}`.length;
    return BASE_URL_WITHOUT_SEED + seedParamLength + encodedPrompt.length;
  };
  
  // Start with a conservative estimate (encoded text is typically 1.4x original)
  // Account for seed parameter (~15 chars) in our estimate
  // With 5000 char limit, we can send much more of the literary text
  const ESTIMATED_SEED_LENGTH = 15;
  const MAX_ENCODED_PROMPT_LENGTH = MAX_URL_LENGTH - BASE_URL_WITHOUT_SEED - ESTIMATED_SEED_LENGTH;
  // Prompt structure: style prefix + text excerpt + style suffix
  const STYLE_PREFIX_LENGTH = STYLE_PREFIX.length;
  const STYLE_SUFFIX_LENGTH = STYLE_SUFFIX.length;
  const TOTAL_STYLE_LENGTH = STYLE_PREFIX_LENGTH + STYLE_SUFFIX_LENGTH;
  let maxTextLength = Math.floor((MAX_ENCODED_PROMPT_LENGTH - TOTAL_STYLE_LENGTH - 10) / 1.4); // -10 for separator and buffer
  maxTextLength = Math.min(maxTextLength, 3000); // Cap at 3000 chars to leave room for style modifiers
  
  // Truncate text to fit
  let textExcerpt = text.substring(0, maxTextLength);
  
  // Build prompt: style prefix FIRST (to prioritize abstraction), then text, then style suffix
  // This structure ensures the model understands we want abstraction, not literal representation
  let visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
  let testUrlLength = calculateUrlLength(visualPrompt);
  
  console.log(`🔍 Initial URL length check: ${testUrlLength} chars (limit: ${MAX_URL_LENGTH}), text excerpt: ${textExcerpt.length} chars`);
  
  // If still too long, reduce text until it fits
  let iterations = 0;
  while (testUrlLength > MAX_URL_LENGTH && textExcerpt.length > 50 && iterations < 20) {
    textExcerpt = text.substring(0, Math.floor(textExcerpt.length * 0.9)); // Reduce by 10%
    visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
    testUrlLength = calculateUrlLength(visualPrompt);
    iterations++;
    console.log(`🔍 Iteration ${iterations}: URL length ${testUrlLength} chars, text excerpt: ${textExcerpt.length} chars`);
  }
  
  // Final safety check - if still too long, use minimal text
  if (testUrlLength > MAX_URL_LENGTH) {
    console.warn(`⚠️ URL still too long after truncation (${testUrlLength} > ${MAX_URL_LENGTH}), using minimal text`);
    textExcerpt = text.substring(0, 100); // Fallback to very short excerpt
    visualPrompt = `${STYLE_PREFIX}${textExcerpt}${STYLE_SUFFIX}`;
    testUrlLength = calculateUrlLength(visualPrompt);
  }
  
  console.log(`✅ Final text excerpt: ${textExcerpt.length} chars`);
  console.log(`📝 Full prompt being sent (first 500 chars): ${visualPrompt.substring(0, 500)}...`);
  console.log(`📝 Full prompt length: ${visualPrompt.length} chars`);

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
 * Documentation: https://pollinations.ai/
 */
async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  
  // Generate a deterministic seed from the prompt for consistency
  // Same prompt = same seed = same image (useful for caching/reproducibility)
  const seed = generateSeedFromString(prompt);
  
  // Using Flux model for high quality, 3072x3072 resolution with seed for ultra high-resolution output
  // Higher resolution ensures quality on detail page, gallery will resize appropriately
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=3072&height=3072&model=flux&seed=${seed}&nologo=true`;
  
  console.log(`🎲 Using seed: ${seed} for prompt (first 50 chars): ${prompt.substring(0, 50)}...`);
  
  // Final safety check - ensure URL is under limit (must match MAX_URL_LENGTH above)
  // Note: seed adds ~10-15 chars to URL, so we account for that
  const MAX_SAFE_URL_LENGTH = 5000;
  if (imageUrl.length > MAX_SAFE_URL_LENGTH) {
    console.warn(`⚠️ URL length (${imageUrl.length}) exceeds safe limit (${MAX_SAFE_URL_LENGTH}). This may cause issues.`);
    // This shouldn't happen with the truncation logic above, but log it if it does
  } else {
    console.log(`✅ URL length (${imageUrl.length}) is within safe limit (${MAX_SAFE_URL_LENGTH})`);
  }
  
  return imageUrl;
}
