/**
 * Test script to verify image generation URL truncation
 * Simulates the actual generateImage function logic
 */

// Simulate the generateImage function logic
function testImageGeneration(text, literaryForm = 'poem') {
  const formMap = {
    'short_poem': 'poem',
    'pop_song': 'song',
    'fairytale': 'fable',
    'sonnet': 'sonnet',
    'epic': 'epic',
    'proverb': 'proverb',
  };
  const originalForm = literaryForm ? (formMap[literaryForm] || literaryForm) : 'text';
  
  const MAX_URL_LENGTH = 950;
  const BASE_URL_LENGTH = 150;
  const PROMPT_TEMPLATE = `Create a beautiful, artistic illustration that captures the essence of this ${originalForm}: `.length;
  const PROMPT_SUFFIX = `. The image should be evocative, poetic, and match the tone and style of the text.`.length;
  const MAX_ENCODED_PROMPT_LENGTH = MAX_URL_LENGTH - BASE_URL_LENGTH;
  
  let maxTextLength = Math.floor((MAX_ENCODED_PROMPT_LENGTH - PROMPT_TEMPLATE - PROMPT_SUFFIX) / 1.4);
  maxTextLength = Math.min(maxTextLength, 300);
  
  let textExcerpt = text.substring(0, maxTextLength);
  
  let visualPrompt = `Create a beautiful, artistic illustration that captures the essence of this ${originalForm}: ${textExcerpt}. The image should be evocative, poetic, and match the tone and style of the text.`;
  let encodedPrompt = encodeURIComponent(visualPrompt);
  let testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
  
  console.log(`\n📝 Testing with text length: ${text.length} chars`);
  console.log(`🔍 Initial URL length check: ${testUrlLength} chars (limit: ${MAX_URL_LENGTH}), text excerpt: ${textExcerpt.length} chars`);
  
  let iterations = 0;
  while (testUrlLength > MAX_URL_LENGTH && textExcerpt.length > 50 && iterations < 20) {
    textExcerpt = text.substring(0, Math.floor(textExcerpt.length * 0.9));
    visualPrompt = `Create a beautiful, artistic illustration that captures the essence of this ${originalForm}: ${textExcerpt}. The image should be evocative, poetic, and match the tone and style of the text.`;
    encodedPrompt = encodeURIComponent(visualPrompt);
    testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
    iterations++;
    console.log(`🔍 Iteration ${iterations}: URL length ${testUrlLength} chars, text excerpt: ${textExcerpt.length} chars`);
  }
  
  if (testUrlLength > MAX_URL_LENGTH) {
    console.warn(`⚠️ URL still too long after truncation (${testUrlLength} > ${MAX_URL_LENGTH}), using minimal text`);
    textExcerpt = text.substring(0, 100);
    visualPrompt = `Create a beautiful, artistic illustration that captures the essence of this ${originalForm}: ${textExcerpt}. The image should be evocative, poetic, and match the tone and style of the text.`;
    encodedPrompt = encodeURIComponent(visualPrompt);
    testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
  }
  
  // Build final URL
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
  const finalUrlLength = imageUrl.length;
  
  console.log(`✅ Final text excerpt: ${textExcerpt.length} chars`);
  console.log(`✅ Final URL length: ${finalUrlLength} chars (limit: ${MAX_URL_LENGTH})`);
  console.log(`✅ Status: ${finalUrlLength <= MAX_URL_LENGTH ? 'PASS' : 'FAIL'}`);
  
  if (finalUrlLength > MAX_URL_LENGTH) {
    console.error(`❌ URL exceeds limit by ${finalUrlLength - MAX_URL_LENGTH} chars!`);
  }
  
  return {
    success: finalUrlLength <= MAX_URL_LENGTH,
    urlLength: finalUrlLength,
    textExcerptLength: textExcerpt.length,
    originalTextLength: text.length,
    url: imageUrl.substring(0, 100) + '...'
  };
}

// Test cases
const testCases = [
  {
    name: 'Short poem',
    text: `In twilight's hush, where shadows play,
A secret's whispered, a promise made.
A child's eyes, like emeralds bright,
Reflect the gaze of a mother's sight.`,
    form: 'short_poem'
  },
  {
    name: 'Long sonnet (like the failing one)',
    text: `When green-eyed gazer's legacy doth live,
In tender shoots of life, a mirrored might,
A reflection of the soul's deep give,
A legacy of emerald's gentle light.

'Tis not the wind that shakes the budding tree,
But nature's subtle art, in secret bred,
A hidden code, where eyes of green do be,
A whispered promise of a lineage bred.

In verdant hues, a story is revealed,
Of heritage and bloodlines true and old,
A testament to love's enduring seal,
A bond that weaves, in threads of green, to hold.

And when the child's eyes first behold the sight,
A spark of green, like embers, glows bright,
A legacy of love, in secret might,
A green-eyed gaze, that through the ages flies.`,
    form: 'sonnet'
  },
  {
    name: 'Very long text (800+ chars)',
    text: 'A'.repeat(800),
    form: 'poem'
  },
  {
    name: 'Text with newlines and special chars',
    text: `In twilight's hush, where shadows play,
A secret's whispered, a promise made.
A child's eyes, like emeralds bright,
Reflect the gaze of a mother's sight.

A thread of legacy, so fine,
Weaves through the generations' line.
A hidden pattern, yet to be told,
A family's story, yet to unfold.

A leaf on a branch, it clings to stay,
A droplet on a leaf, it's mirrored way.
The same green hue, a family's tie,
A symbol of love, that never dies.

In this green-eyed child, a tale's spun,
A thread of heritage, never undone.
Through generations, the color flows,
A legacy that forever grows.`,
    form: 'poem'
  }
];

console.log('🧪 Testing Image Generation URL Truncation\n');
console.log('='.repeat(80));

const results = [];
for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log('-'.repeat(80));
  const result = testImageGeneration(testCase.text, testCase.form);
  results.push({ ...testCase, ...result });
}

console.log('\n\n📊 SUMMARY');
console.log('='.repeat(80));
results.forEach(r => {
  const status = r.success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${r.name}`);
  console.log(`   Original text: ${r.originalTextLength} chars`);
  console.log(`   Final excerpt: ${r.textExcerptLength} chars`);
  console.log(`   URL length: ${r.urlLength} chars (limit: 950)`);
});

const allPassed = results.every(r => r.success);
console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

