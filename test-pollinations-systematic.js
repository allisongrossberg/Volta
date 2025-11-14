/**
 * Systematic test of Pollinations.AI to find what actually works
 */

async function testUrl(url, description) {
  try {
    const response = await fetch(url);
    const status = response.status;
    const success = status === 200;
    console.log(`${success ? '✅' : '❌'} ${description}`);
    console.log(`   URL length: ${url.length} chars`);
    console.log(`   Status: ${status}`);
    if (!success) {
      const errorText = await response.text();
      console.log(`   Error: ${errorText.substring(0, 100)}`);
    }
    return { success, status, urlLength: url.length };
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    return { success: false, error: error.message, urlLength: url.length };
  }
}

async function runTests() {
  console.log('🧪 Systematic Pollinations.AI API Test\n');
  console.log('='.repeat(80));
  
  const results = [];
  
  // Test 1: Simplest possible
  console.log('\n📋 Test 1: Simplest URL');
  results.push(await testUrl(
    'https://image.pollinations.ai/prompt/test',
    'Simple prompt only'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 2: With one parameter
  console.log('\n📋 Test 2: With width parameter');
  results.push(await testUrl(
    'https://image.pollinations.ai/prompt/test?width=1024',
    'Prompt + width'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 3: With multiple parameters (no seed)
  console.log('\n📋 Test 3: With multiple parameters (no seed)');
  results.push(await testUrl(
    'https://image.pollinations.ai/prompt/test?width=1024&height=1024&model=flux&nologo=true',
    'Prompt + all params except seed'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 4: With seed parameter
  console.log('\n📋 Test 4: With seed parameter');
  results.push(await testUrl(
    'https://image.pollinations.ai/prompt/test?seed=123',
    'Prompt + seed only'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 5: All parameters including seed
  console.log('\n📋 Test 5: All parameters including seed');
  results.push(await testUrl(
    'https://image.pollinations.ai/prompt/test?width=1024&height=1024&model=flux&nologo=true&seed=123',
    'Prompt + all params including seed'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 6: Longer prompt (encoded)
  console.log('\n📋 Test 6: Longer prompt');
  const longPrompt = encodeURIComponent('a beautiful sunset over mountains with trees');
  results.push(await testUrl(
    `https://image.pollinations.ai/prompt/${longPrompt}?width=1024&height=1024&model=flux&nologo=true`,
    'Longer prompt (no seed)'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 7: Our actual prompt format (short)
  console.log('\n📋 Test 7: Our prompt format (short)');
  const ourPrompt = encodeURIComponent('Create a beautiful, artistic illustration that captures the essence of this poem: test. The image should be evocative, poetic, and match the tone and style of the text.');
  results.push(await testUrl(
    `https://image.pollinations.ai/prompt/${ourPrompt}?width=1024&height=1024&model=flux&nologo=true`,
    'Our prompt format (short text)'
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 8: Our prompt format with longer text
  console.log('\n📋 Test 8: Our prompt format (longer text)');
  const longText = 'In twilight\'s hush, where shadows play, A secret\'s whispered, a promise made. A child\'s eyes, like emeralds bright, Reflect the gaze of a mother\'s sight.';
  const ourPromptLong = encodeURIComponent(`Create a beautiful, artistic illustration that captures the essence of this poem: ${longText}. The image should be evocative, poetic, and match the tone and style of the text.`);
  const urlLong = `https://image.pollinations.ai/prompt/${ourPromptLong}?width=1024&height=1024&model=flux&nologo=true`;
  results.push(await testUrl(
    urlLong,
    `Our prompt format (longer text, ${urlLong.length} chars)`
  ));
  await new Promise(r => setTimeout(r, 1000));
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(80));
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  console.log('\n✅ Working configurations:');
  results.forEach((r, i) => {
    if (r.success) {
      console.log(`   Test ${i + 1}: URL length ${r.urlLength} chars`);
    }
  });
  
  console.log('\n❌ Failing configurations:');
  results.forEach((r, i) => {
    if (!r.success) {
      console.log(`   Test ${i + 1}: URL length ${r.urlLength} chars, Status: ${r.status || 'Error'}`);
    }
  });
}

runTests().catch(console.error);

