import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { LITERARY_FORMS, generateText, type LiteraryForm } from '../services/textGeneration'
import CircularArrowButton from './CircularArrowButton'
import '../styles/DetailPage.css'

interface DetailPageProps {
  selectedForm: LiteraryForm
  selectedImageUrl: string
  hypothesis: string
  onBack: () => void
  onContinue: (form: LiteraryForm, imageUrl: string, text: string, literaryForm: string) => void
  generatedText?: string // Pre-generated text to use instead of generating on mount
  backgroundColor?: string // Background color extracted from image
}

function DetailPage({ selectedForm, selectedImageUrl, hypothesis, onBack, generatedText, backgroundColor = '#1D1616' }: DetailPageProps) {
  const [text, setText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [textTop, setTextTop] = useState<string>('20vh') // Dynamic top position
  const [isMobile, setIsMobile] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  // Track screen size to determine if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    // Use pre-generated text if available, otherwise generate it
    if (generatedText) {
      setText(generatedText)
      setIsLoading(false)
    } else {
      // Fallback: Generate text if not provided (shouldn't happen in normal flow)
      const loadContent = async () => {
        setIsLoading(true)
        try {
          const textResult = await generateText(hypothesis || "If I observe the natural world, then I will discover patterns and beauty", selectedForm)
          setText(textResult.text)
          setIsLoading(false)
        } catch (error) {
          console.error('Error loading content:', error)
          setIsLoading(false)
        }
      }

      loadContent()
    }
  }, [selectedForm, generatedText, hypothesis])

  // Calculate text position based on actual measurements to prevent overlaps
  // Only calculate for larger screens (mobile uses relative positioning)
  const calculateTextPosition = useCallback(() => {
    if (!text || isLoading || !textRef.current || !imageRef.current) return
    
    // Don't calculate dynamic positioning on mobile (below 769px)
    // Mobile uses relative positioning via CSS
    const viewportWidth = window.innerWidth
    if (viewportWidth <= 768) {
      // Reset to default on mobile to ensure CSS takes over
      setTextTop('auto')
      return
    }

    // Get actual DOM measurements
    const textElement = textRef.current
    const imageElement = imageRef.current
    const viewportHeight = window.innerHeight
    
    // Button dimensions and position (from CSS: top: 2rem = 32px, size: 120px)
    const buttonTop = 32 // 2rem in pixels
    const buttonSize = 120
    const buttonBottom = buttonTop + buttonSize // ~152px from top
    
    // Image position (from CSS: right: 5rem = 80px, top: 10vh, width: 50%, max-width: 900px)
    const imageRight = 80 // 5rem
    const imageTopVh = 10
    const imageTop = (imageTopVh / 100) * viewportHeight
    
    // Get actual image height if available, otherwise use max
    const actualImageHeight = imageElement.offsetHeight || imageElement.scrollHeight || 0
    const imageMaxHeight = Math.min(actualImageHeight || 0.8 * viewportHeight, 0.8 * viewportHeight) // 80vh max
    const imageBottom = imageTop + imageMaxHeight
    
    // Text container dimensions (from CSS: left: 8rem = 128px, width: 40%, max-width: 600px)
    const textLeft = 128 // 8rem
    const textMaxWidth = Math.min(0.4 * viewportWidth, 600)
    const textRight = textLeft + textMaxWidth
    
    // Image width calculation
    const imageWidth = Math.min(0.5 * viewportWidth, 900)
    const imageLeft = viewportWidth - imageRight - imageWidth
    
    // Check for horizontal overlap
    const horizontalOverlap = textRight > imageLeft
    
    // Get actual text height
    const textHeight = textElement.offsetHeight || textElement.scrollHeight
    
    // Calculate safe top position
    // Minimum: below button (buttonBottom + some padding)
    const minTopPx = buttonBottom + 20 // 20px padding below button
    const minTopVh = (minTopPx / viewportHeight) * 100
    
    // Maximum: ensure text doesn't go below image bottom
    const maxTopPx = imageBottom - textHeight - 20 // 20px padding above image bottom
    const maxTopVh = Math.max(minTopVh, (maxTopPx / viewportHeight) * 100)
    
    // If horizontal overlap, adjust text position to be more to the left or above image
    let calculatedTopVh: number
    if (horizontalOverlap) {
      // If text and image overlap horizontally, position text higher to avoid overlap
      // Use a position that's 2/3 up the image area
      const imageCenterVh = imageTopVh + (imageMaxHeight / viewportHeight * 100) / 3
      calculatedTopVh = Math.max(minTopVh, Math.min(maxTopVh, imageCenterVh))
    } else {
      // No horizontal overlap, position based on text length (original logic)
      const textLength = text.length
      const estimatedLines = Math.ceil(textLength / 80)
      
      // Position: shorter text lower, longer text higher
      const preferredMinVh = 30
      const preferredMaxVh = 20
      
      let preferredTopVh: number
      if (estimatedLines <= 4) {
        preferredTopVh = preferredMinVh
      } else if (estimatedLines <= 8) {
        preferredTopVh = preferredMinVh - ((estimatedLines - 4) / 4) * (preferredMinVh - preferredMaxVh)
      } else {
        preferredTopVh = preferredMaxVh
      }
      
      // Clamp to safe bounds
      calculatedTopVh = Math.max(minTopVh, Math.min(maxTopVh, preferredTopVh))
    }
    
    setTextTop(`${calculatedTopVh}vh`)
  }, [text, isLoading])

  useEffect(() => {
    if (!text || isLoading) return

    // Wait for text to render
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(calculateTextPosition)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [text, isLoading])

  // Recalculate position on window resize to keep image stable
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>

    const handleResize = () => {
      // Debounce resize events
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        calculateTextPosition()
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [calculateTextPosition])

  // Use generated title if available, otherwise fall back to form label (for alt text)
  const formConfig = LITERARY_FORMS.find(f => f.value === selectedForm)
  const displayTitle = formConfig?.label.toUpperCase() || 'LITERARY WORK'

  return (
    <motion.div
      className="detail-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Back Button - Top Left */}
      <CircularArrowButton 
        onClick={onBack}
        direction="back"
        position="top-left"
      />
      
      {/* Main Container - Single background */}
      <div className="detail-container" style={{ background: backgroundColor }}>
        {/* Text Content - Positioned next to image */}
        <div 
          className="detail-content" 
          style={{ 
            top: !isMobile ? textTop : 'auto' // Only use dynamic top on larger screens
          }}
        >
          {isLoading ? (
            <div className="detail-loading">Loading content...</div>
          ) : (
            <p ref={textRef} className="detail-text">{text}</p>
          )}
        </div>

        {/* Image - On same background */}
        <div className="detail-image-wrapper">
          <img
            ref={imageRef}
            src={selectedImageUrl}
            alt={displayTitle}
            className="detail-image"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </motion.div>
  )
}

export default DetailPage

