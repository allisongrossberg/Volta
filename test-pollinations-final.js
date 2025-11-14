/**
 * Final test with updated code (simplified prompt, no seed)
 */

// Simulate the updated generateImage function
function generateImageUrl(text, literaryForm = 'poem') {
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
  const BASE_URL_LENGTH = 95;
  const PROMPT_TEMPLATE = `Artistic illustration of this ${originalForm}: `.length;
  const PROMPT_SUFFIX = `. Evocative, poetic style.`.length;
  const MAX_ENCODED_PROMPT_LENGTH = MAX_URL_LENGTH - BASE_URL_LENGTH;
  
  let maxTextLength = Math.floor((MAX_ENCODED_PROMPT_LENGTH - PROMPT_TEMPLATE - PROMPT_SUFFIX) / 1.4);
  maxTextLength = Math.min(maxTextLength, 300);
  
  let textExcerpt = text.substring(0, maxTextLength);
  
  let visualPrompt = `Artistic illustration of this ${originalForm}: ${textExcerpt}. Evocative, poetic style.`;
  let encodedPrompt = encodeURIComponent(visualPrompt);
  let testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
  
  let iterations = 0;
  while (testUrlLength > MAX_URL_LENGTH && textExcerpt.length > 50 && iterations < 20) {
    textExcerpt = text.substring(0, Math.floor(textExcerpt.length * 0.9));
    visualPrompt = `Artistic illustration of this ${originalForm}: ${textExcerpt}. Evocative, poetic style.`;
    encodedPrompt = encodeURIComponent(visualPrompt);
    testUrlLength = BASE_URL_LENGTH + encodedPrompt.length;
    iterations++;
  }
  
  if (testUrlLength > MAX_URL_LENGTH) {
    textExcerpt = text.substring(0, 100);
    visualPrompt = `Artistic illustration of this ${originalForm}: ${textExcerpt}. Evocative, poetic style.`;
    encodedPrompt = encodeURIComponent(visualPrompt);
  }
  
  // NO SEED PARAMETER (causes 530 errors)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true`;
  
  return { imageUrl, textExcerpt, urlLength: imageUrl.length, prompt: visualPrompt };
}

async function testPollinationsAPI(text, literaryForm, testName) {
  console.log(`\n📋 Test: ${testName}`);
  console.log('-'.repeat(80));
  
  const { imageUrl, textExcerpt, urlLength, prompt } = generateImageUrl(text, literaryForm);
  
  console.log(`📝 Original text: ${text.length} chars`);
  console.log(`✂️  Truncated text: ${textExcerpt.length} chars`);
  console.log(`📄 Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`🔗 URL length: ${urlLength} chars`);
  console.log(`🔗 URL (first 150 chars): ${imageUrl.substring(0, 150)}...`);
  
  try {
    console.log('⏳ Making request to Pollinations.AI...');
    const startTime = Date.now();
    
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
      }
    });
    
    const elapsed = Date.now() - startTime;
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      console.log(`✅ SUCCESS - Status: ${response.status}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Length: ${contentLength} bytes`);
      console.log(`   Response time: ${elapsed}ms`);
      return { success: true, status: response.status, urlLength, elapsed };
    } else {
      const errorText = await response.text();
      console.log(`❌ FAILED - Status: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      return { success: false, status: response.status, urlLength, error: errorText, elapsed };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message, urlLength };
  }
}

async function runTests() {
  console.log('🧪 Testing Pollinations.AI API with Updated Code\n');
  console.log('='.repeat(80));
  console.log('Changes: Simplified prompt format, NO seed parameter');
  console.log('='.repeat(80));
  
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
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testPollinationsAPI(testCase.text, testCase.form, testCase.name);
    results.push({ ...testCase, ...result });
    
    // Wait between tests to avoid rate limiting
    if (testCase !== testCases[testCases.length - 1]) {
      console.log('\n⏸️  Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(80));
  results.forEach(r => {
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${r.name}`);
    console.log(`   URL length: ${r.urlLength} chars`);
    if (r.success) {
      console.log(`   Status: ${r.status}, Response time: ${r.elapsed}ms`);
    } else {
      console.log(`   Status: ${r.status || 'Error'}, Error: ${r.error?.substring(0, 100) || r.error}`);
    }
  });
  
  const allPassed = results.every(r => r.success);
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 The updated code should work in the browser!');
  } else {
    console.log('\n⚠️  Some tests failed - may need further adjustments');
  }
}

// Run tests
runTests().catch(console.error);

