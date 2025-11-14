# Quick Setup Guide - Get Dalí-Style Art! 🎨

Follow these steps to generate beautiful surrealist botanical illustrations in the style of Salvador Dalí's Flordali series.

## Step 1: Get Your FREE Hugging Face API Key

1. **Go to Hugging Face**: https://huggingface.co/settings/tokens
2. **Sign up** for a free account (if you don't have one)
3. **Create a new token**:
   - Click "New token"
   - Give it a name (e.g., "ReFrame")
   - Select "Read" access (that's all you need!)
   - Click "Generate a token"
4. **Copy your token** (it looks like: `hf_xxxxxxxxxxxxxxxxxxxxxx`)

## Step 2: Add Your API Key to ReFrame

1. **Create a `.env` file** in the ReFrame project root:
   ```bash
   cd /Users/allisongrossberg/Desktop/ReFrame
   cp .env.example .env
   ```

2. **Edit the `.env` file** and add your key:
   ```env
   VITE_HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Restart your dev server** if it's running:
   ```bash
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

## Step 3: Test It Out!

1. **Open the app** in your browser (usually http://localhost:5173)
2. **Enter a hypothesis**, for example:
   > "If butterflies drink nectar, then flowers will be pollinated"
3. **Click ReFrame** and watch the magic happen!
4. **Look in the browser console** - you should see:
   ```
   🎨 Generating Dalí-style illustration with Hugging Face Stable Diffusion...
   🎨 Trying Stable Diffusion model: black-forest-labs/FLUX.1-schnell
   ✅ Success with image model: black-forest-labs/FLUX.1-schnell
   ```

## What You'll Get

With Hugging Face Stable Diffusion, you'll generate:

✨ **Surrealist Botanical Art** inspired by Dalí's Flordali series:
- Scientifically accurate flora with dreamlike distortions
- Linear vanishing point perspective
- Delicate butterflies and insects
- Warm watercolor tones (oranges, golds, sage green)
- Vintage aged paper aesthetic
- Renaissance naturalist + surrealism fusion

## Troubleshooting

### "No Hugging Face API key found" message?
- Make sure your `.env` file is in the project root
- Make sure it's named exactly `.env` (not `.env.txt`)
- Make sure you restarted the dev server after creating the file
- Check that the key starts with `hf_`

### Images still look generic?
- Check the browser console for error messages
- Hugging Face models may take 20-30 seconds to "warm up" on first use
- If Hugging Face fails, it automatically falls back to Pollinations.AI

### Want even better results?
- The FLUX.1-schnell model is tried first (best for artistic styles)
- If it's busy, it will try SDXL, then SD 2.1, then SD 1.5
- Each model interprets the Dalí style slightly differently

## Cost

**100% FREE!** 🎉
- Hugging Face Inference API has a generous free tier
- You can generate ~1000 images/month for free
- Perfect for personal projects like ReFrame

---

**Need help?** Check the console logs for detailed information about which model is being used and any errors that occur.

