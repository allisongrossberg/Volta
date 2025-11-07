import { ColorPalette } from '../types'

/**
 * Extracts dominant colors from an image URL and generates a color palette
 * Uses HTML5 Canvas API to analyze image pixels
 */
export async function extractColorPalette(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        // Sample pixels (every 10th pixel for performance)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        const colorMap = new Map<string, number>()
        
        // Sample pixels
        for (let i = 0; i < pixels.length; i += 40) { // RGBA = 4 values, so 40 = every 10th pixel
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]
          
          // Skip transparent pixels
          if (a < 128) continue
          
          // Quantize colors to reduce noise (group similar colors)
          const quantizedR = Math.round(r / 32) * 32
          const quantizedG = Math.round(g / 32) * 32
          const quantizedB = Math.round(b / 32) * 32
          
          const colorKey = `${quantizedR},${quantizedG},${quantizedB}`
          colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
        }
        
        // Sort colors by frequency
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Top 10 colors
        
        // Convert to hex and filter out very light/dark colors for better palette
        const hexColors = sortedColors
          .map(([rgb]) => {
            const [r, g, b] = rgb.split(',').map(Number)
            return rgbToHex(r, g, b)
          })
          .filter(color => {
            const { r, g, b } = hexToRgb(color)
            const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255
            // Filter out very dark (< 0.1) and very light (> 0.9) colors
            return luminance >= 0.1 && luminance <= 0.9
          })
        
        if (hexColors.length === 0) {
          // Fallback to default palette if extraction fails
          resolve(getDefaultPalette())
          return
        }
        
        // Generate palette
        const primary = hexColors[0] || '#667eea'
        const secondary = hexColors[1] || hexColors[0] || '#764ba2'
        const accent = hexColors[2] || hexColors[1] || hexColors[0] || '#f093fb'
        
        // Calculate text color based on primary color luminance
        const textColor = getContrastColor(primary)
        
        // Calculate background (lighter version of primary)
        const background = lightenColor(primary, 0.9)
        
        resolve({
          primary,
          secondary,
          accent,
          text: textColor,
          background,
        })
      } catch (error) {
        console.error('Error extracting colors:', error)
        resolve(getDefaultPalette())
      }
    }
    
    img.onerror = () => {
      console.error('Error loading image for color extraction')
      resolve(getDefaultPalette())
    }
    
    img.src = imageUrl
  })
}

/**
 * Converts RGB values to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Converts hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

/**
 * Calculates luminance of a color
 */
function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255
}

/**
 * Returns a contrasting color (black or white) based on background
 */
function getContrastColor(hex: string): string {
  const luminance = getLuminance(hex)
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
}

/**
 * Lightens a color by a factor (0-1)
 */
function lightenColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex)
  const newR = Math.round(r + (255 - r) * factor)
  const newG = Math.round(g + (255 - g) * factor)
  const newB = Math.round(b + (255 - b) * factor)
  return rgbToHex(newR, newG, newB)
}

/**
 * Returns default color palette if extraction fails
 */
function getDefaultPalette(): ColorPalette {
  return {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    text: '#1a1a1a',
    background: '#f5f7fa',
  }
}

