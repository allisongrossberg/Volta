import { useState, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import HomePage from '../components/HomePage'
import GooeyImageGallery from '../components/GooeyImageGallery'
import DetailPage from '../components/DetailPage'
import AboutModal from '../components/AboutModal'
import { LITERARY_FORMS, generateText, type LiteraryForm } from '../services/textGeneration'
import { generateImage } from '../services/imageGeneration'
import '../styles/HomePage.css'
import '../styles/GalleryPage.css'
import '../styles/DetailPage.css'
import '../styles/AnimationPageDirect.css'

type ScreenPhase = 'home' | 'loading' | 'gallery' | 'detail'

interface GeneratedContent {
  text: string
  imageUrl: string
  form: string
}

function AnimationPageDirect() {
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>('home')
  const [hypothesis, setHypothesis] = useState('')
  const [selectedLiteraryForm, setSelectedLiteraryForm] = useState<LiteraryForm | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [_galleryBackgroundColor, setGalleryBackgroundColor] = useState('#1D1616')
  const [detailBackgroundColor, setDetailBackgroundColor] = useState('#1D1616')
  const [generatedContent, setGeneratedContent] = useState<Map<LiteraryForm, GeneratedContent>>(new Map())
  const [_loadingProgress, setLoadingProgress] = useState(0)
  const aboutTriggerRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Disable body scroll when on home page, prevent vertical scroll on gallery
  useEffect(() => {
    if (screenPhase === 'home' || screenPhase === 'loading') {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.touchAction = 'none'
    } else if (screenPhase === 'gallery') {
      // On gallery, allow horizontal scroll but prevent vertical
      document.body.style.overflowX = 'hidden'
      document.body.style.overflowY = 'hidden'
      document.documentElement.style.overflowX = 'hidden'
      document.documentElement.style.overflowY = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
      document.documentElement.style.touchAction = ''
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = ''
      document.body.style.overflowX = ''
      document.body.style.overflowY = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
      document.documentElement.style.overflowX = ''
      document.documentElement.style.overflowY = ''
      document.documentElement.style.touchAction = ''
    }
  }, [screenPhase])

  // Prevent touch/drag events on loading screen
  useEffect(() => {
    if (screenPhase !== 'loading') return
    
    const preventDefault = (e: TouchEvent | MouseEvent) => {
      e.preventDefault()
    }
    
    const preventDrag = (e: DragEvent) => {
      e.preventDefault()
    }
    
    // Prevent all touch and drag events
    document.addEventListener('touchstart', preventDefault, { passive: false })
    document.addEventListener('touchmove', preventDefault, { passive: false })
    document.addEventListener('touchend', preventDefault, { passive: false })
    document.addEventListener('dragstart', preventDrag)
    document.addEventListener('drag', preventDrag)
    
    return () => {
      document.removeEventListener('touchstart', preventDefault)
      document.removeEventListener('touchmove', preventDefault)
      document.removeEventListener('touchend', preventDefault)
      document.removeEventListener('dragstart', preventDrag)
      document.removeEventListener('drag', preventDrag)
    }
  }, [screenPhase])

  // Reset transform when returning to home
  useEffect(() => {
    if (containerRef.current && screenPhase === 'home') {
      containerRef.current.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      containerRef.current.style.transform = 'translateX(0)'
      setTimeout(() => {
        if (containerRef.current && screenPhase === 'home') {
      containerRef.current.style.transition = ''
        }
      }, 800)
    }
  }, [screenPhase])

  // Preload an image to ensure it's ready
  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        console.log(`✅ Image preloaded: ${url.substring(0, 50)}...`)
        resolve()
      }
      img.onerror = () => {
        console.warn(`⚠️ Failed to preload image: ${url.substring(0, 50)}...`)
        // Still resolve to continue - image might load later
        resolve()
      }
      img.src = url
    })
  }

  // Generate content for all literary forms
  const generateAllContent = async (hypothesisText: string) => {
    const newContent = new Map<LiteraryForm, GeneratedContent>()
    const totalForms = LITERARY_FORMS.length
    let completed = 0
    
    try {
      // Generate text and images for all forms in parallel
      const generationPromises = LITERARY_FORMS.map(async (formConfig) => {
        const form = formConfig.value as LiteraryForm
        
        try {
          // Generate text first
          console.log(`📝 Generating text for ${form}...`)
          const textResult = await generateText(hypothesisText, form)
          
          // Generate image using the generated text
          console.log(`🎨 Generating image for ${form}...`)
          const imageUrl = await generateImage(textResult.text, undefined, undefined, form)
          
          if (imageUrl) {
            newContent.set(form, {
              text: textResult.text,
              imageUrl: imageUrl,
              form: textResult.form
            })
            console.log(`✅ Generated content for ${form}`)
          } else {
            console.warn(`⚠️ Failed to generate image for ${form}`)
            // Use placeholder image if generation fails
            newContent.set(form, {
              text: textResult.text,
              imageUrl: `https://picsum.photos/800/600?random=${form}`,
              form: textResult.form
            })
          }
          
          completed++
          setLoadingProgress(Math.round((completed / totalForms) * 50)) // 50% for generation
        } catch (error) {
          console.error(`❌ Error generating content for ${form}:`, error)
          // Use placeholder on error
          newContent.set(form, {
            text: `Error generating content for ${formConfig.label}`,
            imageUrl: `https://picsum.photos/800/600?random=${form}`,
            form: formConfig.label.toUpperCase()
          })
          completed++
          setLoadingProgress(Math.round((completed / totalForms) * 50))
        }
      })
      
      await Promise.all(generationPromises)
      setGeneratedContent(newContent)
      console.log('✅ All content generated successfully')
      
      // Now preload all images
      console.log('🖼️ Preloading all images...')
      const imageUrls = Array.from(newContent.values()).map(content => content.imageUrl)
      const preloadPromises = imageUrls.map((url, index) => 
        preloadImage(url).then(() => {
          const loaded = index + 1
          setLoadingProgress(50 + Math.round((loaded / imageUrls.length) * 50)) // 50-100% for preloading
        })
      )
      
      await Promise.all(preloadPromises)
      console.log('✅ All images preloaded successfully')
      setLoadingProgress(100)
    } catch (error) {
      console.error('❌ Error generating content:', error)
    }
  }

  // Handle home page submit - generate content and transition to loading, then gallery
  const handleHomeSubmit = async () => {
    if (!hypothesis.trim()) return
    
    // Transition to loading screen first
    setScreenPhase('loading')
    setLoadingProgress(0)
    
    // Use CSS transform for smooth slide animation to loading screen
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      containerRef.current.style.transform = 'translateX(-100vw)'
    }
    
    // Start generating content for all forms
    await generateAllContent(hypothesis.trim())
    
    // Wait a moment for UI to update, then transition to gallery
    setTimeout(() => {
      if (containerRef.current) {
        // Set transition first, then transform, then update phase
        containerRef.current.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        // Force a reflow to ensure transition is applied
        containerRef.current.offsetWidth
        containerRef.current.style.transform = 'translateX(-200vw)'
        
        // Update phase after a brief delay to ensure transform is set
      setTimeout(() => {
        setScreenPhase('gallery')
          setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = ''
        }
      }, 800)
        }, 50)
    } else {
      setScreenPhase('gallery')
    }
    }, 500)
  }

  // Extract dominant color from image
  const extractDominantColor = (imageUrl: string, callback: (color: string) => void) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        callback('#1D1616')
        return
      }
      
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // Sample pixels and find dominant color
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const colorCounts: { [key: string]: number } = {}
      
      // Sample every 10th pixel for performance
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // Quantize colors to reduce variations
        const qr = Math.floor(r / 32) * 32
        const qg = Math.floor(g / 32) * 32
        const qb = Math.floor(b / 32) * 32
        const key = `${qr},${qg},${qb}`
        colorCounts[key] = (colorCounts[key] || 0) + 1
      }
      
      // Find most common color
      let maxCount = 0
      let dominantColor = '1D1616'
      for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count
          const [r, g, b] = color.split(',').map(Number)
          // Convert to hex
          dominantColor = [r, g, b].map(x => {
            const hex = x.toString(16)
            return hex.length === 1 ? '0' + hex : hex
          }).join('')
        }
      }
      
      const finalColor = `#${dominantColor}`
      callback(finalColor)
    }
    img.onerror = () => {
      callback('#1D1616')
    }
    img.src = imageUrl
  }

  // Handle form selection from gallery - go to detail page first
  const handleFormSelect = (form: LiteraryForm, imageUrl: string) => {
    setSelectedLiteraryForm(form)
    setSelectedImageUrl(imageUrl)
    
    // Extract dominant color from the selected image
    extractDominantColor(imageUrl, (color) => {
      setDetailBackgroundColor(color)
    })
    
    setScreenPhase('detail')
  }

  const handleDetailBack = () => {
    setScreenPhase('gallery')
  }

  const handleGalleryBack = () => {
    setScreenPhase('home')
    // Reset transform to show home page
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      containerRef.current.style.transform = 'translateX(0)'
    }
  }

  return (
    <>
      {/* About Modal - accessible from Read More button on home page */}
      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)}
        triggerElement={aboutTriggerRef.current}
      />

      {/* Home and Gallery pages */}
      <>
          <div 
            ref={containerRef}
            className="animation-page-direct animation-page-direct-scroll" 
            style={{ 
              minHeight: '100vh',
              width: '300vw', // Triple width to accommodate home, loading, and gallery side by side
              background: '#0e0502',
              position: 'relative',
              overflowX: 'hidden', // Always hidden - we use transform for animation
              overflowY: 'hidden', // No vertical scroll
              display: 'flex',
              flexDirection: 'row',
              willChange: 'transform', // Optimize for animation
              gap: 0, // No gap between pages
              marginTop: '0',
              height: '100vh',
              maxHeight: '100vh',
              touchAction: 'none', // Prevent touch scrolling/dragging
              userSelect: 'none', // Prevent text selection
              WebkitUserSelect: 'none',
              msUserSelect: 'none',
              zIndex: 0 // Base z-index for the container
            }}
          >
      {/* Home Page */}
      <div 
        style={{
          width: '100vw',
          height: '100vh',
          flexShrink: 0,
          position: 'relative',
          margin: 0,
          padding: 0,
          overflowX: 'hidden', // No horizontal scroll
          overflowY: 'hidden', // No vertical scroll
          visibility: screenPhase === 'home' ? 'visible' : 'hidden',
          opacity: screenPhase === 'home' ? 1 : 0,
          pointerEvents: screenPhase === 'home' ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, visibility 0.3s ease'
        }}
      >
        <HomePage
          hypothesis={hypothesis}
          onHypothesisChange={setHypothesis}
          onSubmit={handleHomeSubmit}
          onReadMore={() => setIsAboutOpen(true)}
        />
      </div>

      {/* Loading Screen */}
      <div 
        style={{
          width: '100vw',
          height: '100vh',
          flexShrink: 0,
          position: 'relative',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0e0502',
          color: '#FFFFFF',
          visibility: screenPhase === 'loading' ? 'visible' : 'hidden',
          opacity: screenPhase === 'loading' ? 1 : 0,
          transition: 'opacity 0.3s ease, visibility 0.3s ease',
          pointerEvents: screenPhase === 'loading' ? 'auto' : 'none',
          touchAction: 'none', // Prevent touch scrolling/dragging
          userSelect: 'none', // Prevent text selection
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          zIndex: screenPhase === 'loading' ? 10 : 0 // Higher z-index when loading to stay on top
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          {/* Loading animation */}
          <div className="loader" />
          <style>{`
            .loader {
              width: 50px;
              aspect-ratio: 1;
              color: #FFFFFF;
              border: 2px solid;
              display: grid;
              box-sizing: border-box;
              animation: l1 4s infinite linear;
            }
            .loader::before,
            .loader::after {
              content: "";
              grid-area: 1/1;
              margin: auto;
              width: 70.7%;
              aspect-ratio: 1;
              border: 2px solid;
              box-sizing: content-box;
              animation: inherit;
            }
            .loader::after {
              width: 50%;
              aspect-ratio: 1;
              border: 2px solid;
              animation-duration: 2s;
            }
            @keyframes l1 {
              100% { transform: rotate(1turn); }
            }
          `}</style>
        </div>
      </div>

      {/* Gallery Screen */}
      <div 
        style={{
          width: '100vw',
          height: '100vh', // Full height - no header on gallery
          flexShrink: 0,
          position: 'relative',
          margin: 0,
          padding: 0,
          overflow: 'hidden', // Hide all overflow - gallery handles its own scrolling
          display: 'block', // Always in layout for transform to work
          visibility: screenPhase === 'gallery' || screenPhase === 'detail' ? 'visible' : 'hidden',
          opacity: screenPhase === 'gallery' || screenPhase === 'detail' ? 1 : 0,
          pointerEvents: screenPhase === 'gallery' || screenPhase === 'detail' ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, visibility 0.3s ease',
          zIndex: 1 // Above background text (z-index 0)
        }}
      >
        <GooeyImageGallery 
          onSelectForm={handleFormSelect}
          onBackgroundColorChange={setGalleryBackgroundColor}
          isVisible={screenPhase === 'gallery'} // Only show progress bar on gallery screen
          onBack={handleGalleryBack}
          generatedContent={generatedContent}
        />
      </div>

          </div>

          {/* Detail Page */}
          <AnimatePresence mode="wait">
            {screenPhase === 'detail' && selectedLiteraryForm && selectedImageUrl && (
              <DetailPage
                selectedForm={selectedLiteraryForm}
                selectedImageUrl={selectedImageUrl}
                hypothesis={hypothesis}
                onBack={handleDetailBack}
                onContinue={() => {}} // No-op since we're not transitioning anymore
                generatedText={generatedContent.get(selectedLiteraryForm)?.text}
                backgroundColor={detailBackgroundColor}
              />
            )}
          </AnimatePresence>
      </>
    </>
  )
}

export default AnimationPageDirect
