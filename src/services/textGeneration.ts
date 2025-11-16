/**
 * Text Generation Service
 * Uses Hugging Face Inference API to transform hypotheses into literary forms
 * Matches original API logic from commit 0b80fee
 */

// API key
const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';

// Debug logging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    hasHuggingFaceKey: !!HUGGINGFACE_API_KEY,
    huggingFaceKeyPrefix: HUGGINGFACE_API_KEY ? HUGGINGFACE_API_KEY.substring(0, 10) + '...' : 'none',
  });
}

// Literary form options
export const LITERARY_FORMS = [
  { value: 'short_poem', label: 'Short Poem', style: 'In the style of Robert Frost or Emily Dickinson' },
  { value: 'sonnet', label: 'Soliloquy or Sonnet', style: 'In the style of Shakespeare' },
  { value: 'epic', label: 'Short Epic', style: 'In the style of Homer' },
  { value: 'pop_song', label: 'Song', style: 'In the style of Taylor Swift' },
  { value: 'fairytale', label: 'Fairytale, Fable or Myth', style: 'In the style of old Scottish/Irish/Norse/Greek tales' },
  { value: 'proverb', label: 'Proverb', style: 'In the style of Buddhist or African proverbs' },
] as const;

export type LiteraryForm = typeof LITERARY_FORMS[number]['value'];

const LITERARY_FORM_DESCRIPTIONS: Record<string, string> = {
  short_poem: 'a short poem in the style of Robert Frost or Emily Dickinson',
  sonnet: 'a soliloquy or sonnet in the style of Shakespeare',
  epic: 'a short epic in the style of Homer',
  pop_song: 'a catchy pop song in the style of Taylor Swift',
  fairytale: 'a short fairytale, fable or myth in the style of old Scottish/Irish/Norse/Greek tales',
  proverb: 'a proverb in the style of Buddhist or African proverbs',
};

/**
 * Generate literary text from a hypothesis using Hugging Face API
 * Uses OpenAI-compatible router endpoint from original commit 0b80fee
 * Only calls API ONCE for the selected literary form
 */
export async function generateText(
  hypothesis: string,
  literaryForm: LiteraryForm
): Promise<{ text: string; form: string }> {
  if (!HUGGINGFACE_API_KEY) {
    console.warn('⚠️ No Hugging Face API key found - using mock response');
    return getMockResponse(hypothesis, literaryForm);
  }

  const formDescription = LITERARY_FORM_DESCRIPTIONS[literaryForm] || literaryForm;
  const formConfig = LITERARY_FORMS.find(f => f.value === literaryForm);

  // Style examples for each literary form to guide the model
  const styleExamples: Record<LiteraryForm, string> = {
    short_poem: `Examples of the style we admire:
- Robert Frost: "Two roads diverged in a yellow wood, / And sorry I could not travel both / And be one traveler, long I stood / And looked down one as far as I could"
- Emily Dickinson: "Because I could not stop for Death – / He kindly stopped for me – / The Carriage held but just Ourselves – / And Immortality"
Write with their clarity, natural imagery, and contemplative tone.`,
    sonnet: `Examples of the style we admire:
- Shakespeare: "Shall I compare thee to a summer's day? / Thou art more lovely and more temperate: / Rough winds do shake the darling buds of May, / And summer's lease hath all too short a date"
- Shakespeare's soliloquies: "To be, or not to be, that is the question: / Whether 'tis nobler in the mind to suffer / The slings and arrows of outrageous fortune"
Write with their eloquence, rhythm, and profound expression.`,
    epic: `Examples of the style we admire:
- Homer's Iliad: "Sing, O goddess, the anger of Peleus' son Achilles, that brought countless ills upon the Achaeans"
- Homer's Odyssey: "Tell me, O muse, of that ingenious hero who travelled far and wide after he had sacked the famous town of Troy"
Write with their grandeur, narrative power, and epic scope.`,
    pop_song: `Examples of diverse song styles we admire:
- Pop: Taylor Swift's emotional storytelling, Billie Eilish's introspective lyrics, Elton John's theatrical grandeur
- Jazz/Soul: Aretha Franklin's powerful expression, Stevie Wonder's poetic depth
- Rock: The Beatles' innovative wordplay, Queen's dramatic flair, Prince's sensuality, Stevie Nicks' mystical imagery
- Folk: Bob Dylan's narrative storytelling and social commentary
- Coffeehouse/Contemporary: John Mayer's introspective lyrics, Hozier's literary references
- Timeless Icons: Elvis Presley's emotion, Billy Joel's storytelling, Whitney Houston's passion, Celine Dion's drama, Garth Brooks' relatability
Write with authentic lyrical style, memorable hooks, emotional resonance, and the spirit of these diverse musical traditions. Include verse and chorus structure.`,
    fairytale: `Examples of the style we admire:
- Old Scottish/Irish/Norse/Greek tales: "Once upon a time, in a land far away..." 
- The Brothers Grimm, Hans Christian Andersen, ancient myths with their timeless quality
Write with their timeless quality, moral depth, and enchanting narrative style.`,
    proverb: `Examples of the style we admire:
- Buddhist proverbs: "The mind is everything. What you think you become."
- African proverbs: "If you want to go fast, go alone. If you want to go far, go together."
Write with their wisdom, brevity, and universal truth. IMPORTANT: Keep it SHORT - maximum 3 sentences.`,
  };

  // Create enhanced prompt with style examples
  const prompt = `Transform the following scientific hypothesis into ${formDescription}. 
Do NOT simply restate the hypothesis literally. Instead, create a creative, poetic interpretation that captures the essence and meaning through metaphor, imagery, and literary artistry.

${styleExamples[literaryForm]}

Hypothesis: ${hypothesis}

Requirements:
- Capture the CORE CONCEPT and MEANING, not the literal words
- Use metaphor, symbolism, and poetic imagery to express the scientific idea
- Use the specified literary style authentically (refer to the examples above)
- Be creative and evocative - transform the concept into art, not a direct translation
- Keep it concise: maximum 200 words or 20 lines (PROVERBS: maximum 3 sentences)
- Make it beautiful, poetic, and memorable
- Avoid simply restating the hypothesis - interpret it through the lens of the literary form
- CRITICAL: Provide ONLY ONE literary work - do NOT give multiple options or alternatives
- CRITICAL: Do NOT use "Or" to separate different versions - give me your BEST single version
- No additional commentary, explanation, or alternatives - only the ONE literary work itself

Begin your ${formDescription} now (remember: ONLY ONE version, no alternatives):`;

  // Try multiple chat models in order of preference
  // Mix of different model families for variety
  const models = [
    'google/gemma-2-2b-it', // Google's Gemma 2 instruct model - good for creative tasks
    'tiiuae/falcon-7b-instruct', // Falcon instruct model - strong performance
    'microsoft/Phi-3.5-mini-instruct', // Microsoft's efficient model
    'meta-llama/Llama-3.2-3B-Instruct', // Llama fallback - proven to work
    'meta-llama/Llama-3.1-8B-Instruct', // Larger Llama model
    'Qwen/Qwen2.5-Coder-32B-Instruct', // Qwen model
    // Note: mistralai/Mistral-7B-Instruct-v0.3 not supported by router (not a chat model)
  ];
  
  for (const modelName of models) {
    try {
      console.log(`📝 Trying text generation model: ${modelName}`);
      
      // Use OpenAI-compatible router endpoint from original commit
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000, // Limit response length
          temperature: 0.7,
          top_p: 0.9,
        }),
        mode: 'cors',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        // Check if it's a "not a chat model" error - skip silently
        if (errorData.error?.code === 'model_not_supported' || 
            errorData.error?.message?.includes('not a chat model')) {
          console.log(`⏭️ Skipping ${modelName} - not a chat model`);
          continue;
        }
        
        console.warn(`⚠️ Model ${modelName} failed:`, errorData.error?.message || errorText);
        continue; // Try next model
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let generatedText = '';
      if (data.choices && data.choices[0]?.message?.content) {
        generatedText = data.choices[0].message.content.trim();
      } else if (data.content) {
        generatedText = data.content.trim();
      } else if (data.text) {
        generatedText = data.text.trim();
      } else if (typeof data === 'string') {
        generatedText = data.trim();
      } else {
        console.warn(`⚠️ Unexpected response format from ${modelName}:`, data);
        continue; // Try next model
      }
      
      if (!generatedText) {
        console.warn(`⚠️ Empty response from ${modelName}`);
        continue; // Try next model
      }
      
      // CRITICAL: Remove multiple options if model generated them
      // Split by "Or" (with surrounding whitespace/newlines) and take only the first option
      const orPattern = /\n\s*Or\s*\n|\n\s*or\s*\n|^Or\s*$|^or\s*$/gm;
      if (orPattern.test(generatedText)) {
        console.log(`⚠️ Model generated multiple options with "Or" - taking first option only`);
        // Split on "Or" and take the first part
        const firstOption = generatedText.split(/\n\s*[Oo]r\s*\n/)[0].trim();
        generatedText = firstOption;
      }
      
      // Also remove trailing "Or" at the end if present
      generatedText = generatedText.replace(/\s+[Oo]r\s*$/g, '').trim();
      
      // Enforce length limit (approximately 200 words or 20 lines)
      const lines = generatedText.split('\n');
      if (lines.length > 20) {
        generatedText = lines.slice(0, 20).join('\n');
      }
      const words = generatedText.split(/\s+/);
      if (words.length > 200) {
        generatedText = words.slice(0, 200).join(' ');
      }
      
      console.log(`✅ Success with text model: ${modelName}`);
      return {
        text: generatedText,
        form: formConfig?.label.toUpperCase() || 'LITERARY WORK',
      };
    } catch (error) {
      console.error(`❌ Error with model ${modelName}:`, error);
      continue; // Try next model
    }
  }
  
  // If all models failed, return mock
  console.warn('⚠️ All text generation models failed - using mock response');
  return getMockResponse(hypothesis, literaryForm);
}

/**
 * Mock response for testing (when no API key is available)
 */
function getMockResponse(_hypothesis: string, literaryForm: LiteraryForm): { text: string; form: string } {
  const formConfig = LITERARY_FORMS.find(f => f.value === literaryForm);
  
  const mockTexts: Record<LiteraryForm, string> = {
    short_poem: `The Sun—a silent Teacher—

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
    pop_song: `🎵 Verse 1:

Started as a seed in the darkest corner

Barely growing, feeling like a foreigner

Then you moved me to the window bay

Now I'm reaching higher every single day

Chorus:

'Cause sunlight, sunlight, makes me grow

Taller than I've ever known

Dancing in your golden glow

That's the only way I know

To rise up, rise up, toward the sky

Sunlight's got me growing high

(Growing high, growing high)`,
    fairytale: `Long ago in the emerald hills of Tír na nÓg, two sister-seeds fell from the pouch of a traveling druid. One landed in a sunny meadow where the sun spirits danced from dawn till dusk. The other tumbled into a cave where only shadows dwelt.

The meadow sister grew tall as an oak, her green arms strong enough to embrace the clouds. But the cave sister remained small as a mushroom, pale and wondering.

One day, a wise crow perched between them and cawed: "See how the sun's blessing chooses favorites? She who bathes in light touches the sky, while she who knows only darkness barely knows herself at all."

And so it has been since the world was young—the sun lifts up those who seek her face.`,
    proverb: `"The plant that follows the sun's path grows tall enough to shade its children; the one that hides from light remains forever a child itself."`,
  };

  return {
    text: mockTexts[literaryForm] || mockTexts.short_poem,
    form: formConfig?.label.toUpperCase() || 'LITERARY WORK',
  };
}
