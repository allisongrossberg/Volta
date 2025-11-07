# ReFrame

A web application that transforms scientific hypotheses into beautiful literary forms, accompanied by AI-generated illustrations with dynamic theming.

## Features

- **Input Page**: Enter your scientific hypothesis and select a literary form
- **Loading Page**: Beautiful loading animation while processing
- **Output Page**: View your transformed hypothesis as literature with matching illustration
- **Dynamic Theming**: The entire page adapts its colors based on the generated illustration
- **Free Image Generation**: Uses Pollinations.AI by default (no API key required!)

## Literary Forms

1. **Short Poem** - In the style of Robert Frost or Emily Dickinson
2. **Soliloquy or Sonnet** - In the style of Shakespeare
3. **Short Epic** - In the style of Homer
4. **Catchy Pop Song** - In the style of Taylor Swift
5. **Fairytale, Fable or Myth** - In the style of old Scottish/Irish/Norse/Greek tales
6. **Proverb** - In the style of Buddhist or African proverbs

## Setup

1. Install dependencies:
```bash
npm install
```

2. (Optional) Create a `.env` file in the root directory:
```env
# For text generation - choose one:
# Option 1: Claude API (paid, best quality)
VITE_CLAUDE_API_KEY=your_claude_api_key_here

# Option 2: Hugging Face API (FREE tier available!)
# Get free API key at: https://huggingface.co/settings/tokens
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Optional: For paid image generation (DALL-E 3)
VITE_DALLE_API_KEY=your_openai_api_key_here

# Optional: Choose image provider - 'pollinations' (default, free), 'dalle', or 'huggingface'
VITE_IMAGE_PROVIDER=pollinations
```

**Note:** 
- **Text generation**: Works FREE with Hugging Face API key (uses Mistral-7B model). Falls back to mock responses if no keys provided.
- **Image generation**: Works completely FREE by default using Pollinations.AI - no API keys needed!

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## API Integration

The application integrates with:
- **Text Generation** - Multiple options available (see below)
- **Image Generation** - Multiple options available (see below)

### Text Generation Options

#### 🆓 FREE Option (Recommended for Testing!)
**Hugging Face Inference API** - Free tier available
- ✅ **100% Free** - Generous rate limits
- ✅ **Easy Setup** - Get free API key at https://huggingface.co/settings/tokens
- ✅ **Good Quality** - Uses Mistral-7B-Instruct model
- Uses the same API key as image generation (if you want both)

#### 💰 Paid Option
**Claude API** (Anthropic) - Premium quality
- ✅ **Best Quality** - Excellent creative writing
- ✅ **Reliable** - Stable and well-documented
- 💵 **Cost**: Pay-as-you-go pricing
- Best for production use with budget

#### 🎭 Fallback Option
**Mock Responses** - Built-in examples
- ✅ **No API Key Needed** - Works immediately
- ✅ **Instant** - No API calls
- Perfect for UI/UX testing

The app will automatically try Claude first (if key provided), then Hugging Face (if key provided), then fall back to mock responses.

### Image Generation Options

#### 🆓 FREE Option (Default - No API Key Required!)
**Pollinations.AI** - Completely free, no sign-up, no API key needed!
- ✅ **100% Free** - Unlimited use
- ✅ **No API Key** - Works out of the box
- ✅ **Privacy-Focused** - Zero data storage
- ✅ **Fast** - On-the-fly image generation
- Uses Stable Diffusion Flux model for high-quality results

#### 🆓 FREE Option (With Free API Key)
**Hugging Face Inference API** - Free tier available
- Get free API key at: https://huggingface.co/settings/tokens
- Uses Stable Diffusion XL
- Free tier has rate limits but generous for personal use

#### 💰 Paid Option
**DALL-E 3** (OpenAI) - Premium quality
- ✅ **High Quality** - Excellent text-to-image understanding
- ✅ **Reliable** - Stable and well-documented
- 💵 **Cost**: ~$0.04-0.12 per image
- Best for production use with budget

### How to Choose Image Provider

Set `VITE_IMAGE_PROVIDER` in your `.env`:
- `pollinations` (default) - Uses Pollinations.AI, no key needed
- `huggingface` - Uses Hugging Face (requires free API key)
- `dalle` - Uses DALL-E 3 (requires paid API key)

The app will automatically fall back to free options if paid APIs fail or aren't configured.

## Dynamic Theming

The application features **dynamic theming** that extracts color palettes from generated illustrations and applies them to the entire UI:

- **Automatic Color Extraction**: Analyzes the generated image to find dominant colors
- **Smart Palette Generation**: Creates primary, secondary, and accent colors
- **Smooth Transitions**: Colors transition smoothly when new themes are applied
- **Accessible Contrast**: Automatically ensures text remains readable

The theming system uses CSS custom properties (CSS variables) for seamless color updates across all UI elements.

## Development Notes

- The app uses React Router for navigation
- State is managed via sessionStorage to pass data between pages
- Mock responses are included for testing without API keys
- The UI is responsive and works on mobile devices
- Color extraction uses HTML5 Canvas API for pixel analysis
- Dynamic theming is implemented via CSS custom properties

## Future Enhancements

- Video generation support (Sora, Runway, etc.)
- Additional image providers
- Custom theme presets
- Export themes as CSS files

