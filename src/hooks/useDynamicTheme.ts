import { useEffect } from 'react'
import { ColorPalette } from '../types'

/**
 * Custom hook to apply dynamic theming based on color palette
 * Sets CSS custom properties on the document root
 */
export function useDynamicTheme(palette: ColorPalette | undefined) {
  useEffect(() => {
    if (!palette) {
      // Reset to default theme
      resetTheme()
      return
    }

    // Set CSS custom properties
    const root = document.documentElement
    root.style.setProperty('--theme-primary', palette.primary)
    root.style.setProperty('--theme-secondary', palette.secondary)
    root.style.setProperty('--theme-accent', palette.accent)
    root.style.setProperty('--theme-text', palette.text)
    root.style.setProperty('--theme-background', palette.background)
    
    // Generate gradient from primary and secondary
    root.style.setProperty(
      '--theme-gradient',
      `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`
    )
    
    // Generate lighter gradient for backgrounds
    root.style.setProperty(
      '--theme-gradient-light',
      `linear-gradient(135deg, ${lightenHex(palette.primary, 0.1)} 0%, ${lightenHex(palette.secondary, 0.1)} 100%)`
    )

    // Cleanup function to reset theme when component unmounts or palette changes
    return () => {
      // Don't reset on cleanup - let new theme apply smoothly
    }
  }, [palette])
}

/**
 * Resets theme to default values
 */
function resetTheme() {
  const root = document.documentElement
  root.style.setProperty('--theme-primary', '#667eea')
  root.style.setProperty('--theme-secondary', '#764ba2')
  root.style.setProperty('--theme-accent', '#f093fb')
  root.style.setProperty('--theme-text', '#1a1a1a')
  root.style.setProperty('--theme-background', '#f5f7fa')
  root.style.setProperty(
    '--theme-gradient',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  )
  root.style.setProperty(
    '--theme-gradient-light',
    'linear-gradient(135deg, #7c8ef0 0%, #8a5fb8 100%)'
  )
}

/**
 * Lightens a hex color by a percentage
 */
function lightenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent))
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent))
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

