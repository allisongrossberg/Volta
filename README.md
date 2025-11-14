# ReFrame

A web application that transforms scientific hypotheses into beautiful literary forms, accompanied by AI-generated illustrations with dynamic theming.

## Features

- **Minimalist Input Page**: 
  - Clean, editorial-style design inspired by modern portfolios
  - Fixed sidebar navigation with numbered sections
  - Borderless input field with focus transitions
  - Typography-focused layout (Space Grotesk + Inter)
  - Pure white background with subtle gray accents
  - Character counter and real-time validation
  - Smooth Framer Motion animations
  - Fully responsive grid layout
  
- **Magical Loading Experience**: 
  - **Words Transform into Birds**: Hypothesis text morphs into a flock of birds
  - **Flocking Simulation**: Realistic boids algorithm with separation, alignment, and cohesion
  - **Progressive Reveal**: Birds fly across the screen revealing the AI illustration
  - Real-time progress tracking
  - Smooth transitions and natural bird movements

- **Stunning Output Page**: 
  - View your transformed hypothesis as literature with WebGL-enhanced illustrations
  - Real-time canvas effects with progressive reveal animations
  - Shader effects and particle systems
  - 3D coverflow carousel transitions between literary forms
  
- **Dynamic Theming**: The entire page adapts its colors based on generated illustrations

- **Surrealist AI Art**:
  - **Dalí-Inspired Style**: Illustrations in the style of Salvador Dalí's Flordali series
  - Surrealist botanical drawings with dreamlike elements, perspective lines, and butterflies
  - Stable Diffusion via Hugging Face (FLUX, SDXL, SD 2.1) - FREE with API key
  - Automatic fallback to Pollinations.AI (no API key required!)
  - Multiple text generation models for literary transformations

## Literary Forms

1. **Short Poem** - In the style of Robert Frost or Emily Dickinson
2. **Soliloquy or Sonnet** - In the style of Shakespeare
3. **Short Epic** - In the style of Homer
4. **Song** - In the style of Taylor Swift
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
- **Image generation**: 
  - **RECOMMENDED**: Use Hugging Face Stable Diffusion for best results with Dalí-inspired surrealist style
  - Get your FREE Hugging Face API key at: https://huggingface.co/settings/tokens
  - Falls back to Pollinations.AI if no key is provided
  - Art style: Salvador Dalí's Flordali series - surrealist botanical illustrations

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

#### 🆓 FREE Option (Fallback - No API Key Required!)
**Pollinations.AI** - Completely free, no sign-up, no API key needed!
- ✅ **100% Free** - Unlimited use
- ✅ **No API Key** - Works out of the box
- ✅ **Privacy-Focused** - Zero data storage
- ✅ **Fast** - On-the-fly image generation
- Uses Stable Diffusion Flux model
- Note: Hugging Face generally produces better results for the Dalí-inspired style

#### 🆓 FREE Option (Recommended - With Free API Key)
**Hugging Face Inference API** - Free tier available
- ✅ **Best for Dalí-inspired surrealist botanical art**
- Get free API key at: https://huggingface.co/settings/tokens
- Uses Stable Diffusion models (FLUX.1, SDXL, SD 2.1)
- Free tier has rate limits but generous for personal use
- Optimized prompts for vintage botanical + surrealism style
- Higher quality and more artistic control than Pollinations

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
- **WebGL Features**: Built with Three.js for immersive 3D experiences
  - Custom GLSL shaders for progressive image reveal
  - Particle systems with physics-based animation
  - Real-time morphing geometry
  - 3D carousel with coverflow effect
  - Optimized for performance with requestAnimationFrame

## WebGL Features

The application now includes immersive WebGL experiences powered by Three.js:

### Input Page - Minimalist Editorial Design
- **Layout**:
  - Fixed sidebar navigation (200px width)
  - Grid-based responsive layout
  - Content centered in main area with max-width
  - Clean white background (#ffffff on #ffffff)
  - Subtle gray borders (#f0f0f0)
  
- **Sidebar Navigation**:
  - Numbered sections (001, 002, etc.)
  - Version information in footer
  - Hover opacity transitions
  - Mobile-responsive (horizontal on small screens)
  
- **Typography**:
  - Space Grotesk for headings (uppercase)
  - Inter for body text and UI elements
  - Tight letter spacing and modern proportions
  - Clear hierarchy with size and weight
  
- **Input Field**:
  - Borderless design with bottom border only
  - Border transitions from #e0e0e0 → #000000 on focus
  - Transparent background
  - Real-time character counter
  - Shake animation for validation errors
  
- **Interactions**:
  - Black button with white text
  - Inverted colors on hover
  - Smooth 0.2s transitions
  - Scale feedback on interactions
  - Framer Motion entrance animations
  
### Loading Page - Word-to-Bird Animation
- **Phase 1: Text Transformation** (0-2 seconds):
  - Each word from the hypothesis becomes a text sprite
  - Words arranged in a circular formation
  - Text sprites morph and fade into bird shapes
  - Scale and rotation transitions
  
- **Phase 2: Flocking Behavior** (2+ seconds):
  - **Boids Algorithm**: 
    - Separation: Birds avoid crowding neighbors
    - Alignment: Birds steer towards average heading of neighbors
    - Cohesion: Birds steer towards average position of neighbors
  - Natural bird movement with velocity limiting
  - Screen edge wrapping for continuous motion
  - Birds rotate to face direction of travel
  
- **Phase 3: Image Reveal**:
  - Birds paint white trails on a reveal canvas
  - Trails act as mask to progressively show the illustration
  - Shader-based reveal with shimmer effects on edges
  - Real-time progress tracking (0-100%)
  - Automatic navigation when 80% revealed
  
- **Technical Implementation**:
  - Canvas-based reveal texture updated per frame
  - Custom THREE.js sprites for text and birds
  - Dynamic lighting and camera positioning
  - Efficient memory management and cleanup

### Output Page
- **Progressive Reveal**: Images appear with radial reveal animation from center
- **Shader Effects**: 
  - Organic noise-based edge distortion
  - Shimmer effects during reveal
  - Edge glow with custom colors
  - Smooth opacity transitions
- **Particle Systems**: 200 particles per illustration with physics
- **3D Transitions**: Coverflow effect between literary forms with perspective
- **Floating Animations**: Subtle rotation and translation for depth

### Performance Optimizations
- Efficient render loops with requestAnimationFrame
- Automatic cleanup on component unmount
- Responsive canvas sizing
- Device pixel ratio optimization
- Geometry and material disposal

## Future Enhancements

- Interactive particle manipulation
- User-customizable shader parameters
- Video generation support (Sora, Runway, etc.)
- Additional WebGL effects (post-processing, bloom, etc.)
- Custom theme presets
- Export themes as CSS files
- VR/AR support
