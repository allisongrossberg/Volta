import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ExplodingTextToBirds from '../components/ExplodingTextToBirds'
import ButtonToBirdThreeJS from '../components/ButtonToBirdThreeJS'
import AboutModal from '../components/AboutModal'
import '../styles/InputPage.css'
import '../styles/LoadingPage.css'
import '../styles/OutputPage.css'

type AnimationPhase = 'input' | 'animating' | 'output'

function AnimationPage() {
  const [hypothesis, setHypothesis] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)

  // Enforce character limit - ensure hypothesis never exceeds 300 characters
  useEffect(() => {
    if (hypothesis.length > 300) {
      const trimmed = hypothesis.slice(0, 300)
      setHypothesis(trimmed)
      setCharCount(300)
    }
  }, [hypothesis])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<AnimationPhase>('input')
  const [finalText, setFinalText] = useState<string>('')
  const [particlesFormed, setParticlesFormed] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [showButtonAnimation, setShowButtonAnimation] = useState(false)
  const [showBirdFlocking, setShowBirdFlocking] = useState(false)
  const [literaryForm, setLiteraryForm] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aboutTriggerRef = useRef<HTMLSpanElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const htmlAnimationHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)

  // Attach HTML's click handler directly to button (runs immediately on click, like HTML version)
  useEffect(() => {
    const button = submitButtonRef.current
    if (!button) return

    const handleButtonClick = (e: MouseEvent) => {
      // Only run if button doesn't already have 'active' class
      // (This matches the HTML's check: if(!button.classList.contains('active')))
      if (!button.classList.contains('active') && !isSubmitting && hypothesis.trim()) {
        console.log('🎯 Button clicked - setting up for animation')
        
        // Prevent form submission (we'll handle it separately)
        e.preventDefault()
        e.stopPropagation()
        
        // Set submitting state
        setIsSubmitting(true)
        
        // Add active class (HTML does this)
        button.classList.add('active')
        
        // Set button to fixed position (like in handleSubmit)
        const buttonRect = button.getBoundingClientRect()
        button.style.left = `${buttonRect.left}px`
        button.style.top = `${buttonRect.top}px`
        button.style.width = `${buttonRect.width}px`
        button.style.height = `${buttonRect.height}px`
        button.style.isolation = 'isolate'
        button.style.willChange = 'transform, opacity'
        void button.offsetWidth // Force reflow
        
        // Hide textarea
        if (textareaRef.current) {
          textareaRef.current.style.opacity = '0'
          textareaRef.current.style.transition = 'opacity 0.3s'
        }
        
        // Fade form group
        const formGroup = document.querySelector('.form-group') as HTMLElement
        if (formGroup) {
          formGroup.style.transition = 'opacity 0.3s ease-out'
          formGroup.style.opacity = '0'
        }
        
        // Update phase - ButtonToBirdThreeJS will handle the actual animation
        setPhase('animating')
        setShowButtonAnimation(true)
        
        console.log('✅ Button setup complete - ButtonToBirdThreeJS will handle animation')
      }
    }

    // Attach the click handler (like HTML does)
    button.addEventListener('click', handleButtonClick)
    htmlAnimationHandlerRef.current = handleButtonClick

    return () => {
      if (button && htmlAnimationHandlerRef.current) {
        button.removeEventListener('click', htmlAnimationHandlerRef.current)
      }
    }
  }, [isSubmitting, hypothesis])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // If button already has 'active' class, the click handler already started the animation
    // Just return - don't duplicate the animation
    if (submitButtonRef.current?.classList.contains('active')) {
      console.log('⚠️ Button already active - animation already started by click handler')
      return
    }
    
    if (isSubmitting || !hypothesis.trim()) {
      return
    }
    
    // The click handler will handle everything, but if for some reason it didn't fire,
    // we can still run the old logic as a fallback
    console.log('⚠️ Form submit handler called - click handler should have handled this')
    
    // Store button position for animation
    const submitButton = submitButtonRef.current
    if (submitButton) {
      const buttonRect = submitButton.getBoundingClientRect()
      sessionStorage.setItem('buttonPosition', JSON.stringify({
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2,
        width: buttonRect.width,
        height: buttonRect.height
      }))
    }
    
    // Hide textarea immediately to prevent text from showing
    if (textareaRef.current) {
      textareaRef.current.style.opacity = '0'
      textareaRef.current.style.transition = 'opacity 0.3s'
    }
    
    // CRITICAL: Keep button FULLY VISIBLE for morphing animation
    // Add 'active' class which will make it fixed position and always visible
    // MUST do this BEFORE fading form group to prevent opacity inheritance issues
    if (submitButton) {
      const buttonRect = submitButton.getBoundingClientRect()
      
      // Add active class FIRST (CSS will make it fixed and visible with !important)
      submitButton.classList.add('active')
      
      // Set fixed position to keep it in the same visual location
      // Use getBoundingClientRect values directly (already relative to viewport)
      submitButton.style.left = `${buttonRect.left}px`
      submitButton.style.top = `${buttonRect.top}px`
      submitButton.style.width = `${buttonRect.width}px`
      submitButton.style.height = `${buttonRect.height}px`
      
      // CRITICAL: Force button to be on its own stacking context
      // This prevents parent opacity/transform from affecting it
      submitButton.style.isolation = 'isolate'
      submitButton.style.willChange = 'transform, opacity'
      
      // Force a reflow to ensure fixed positioning is applied
      void submitButton.offsetWidth
      
      console.log('🔍 Button after submit - made active and fixed:', {
        left: buttonRect.left,
        top: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
        hasActiveClass: submitButton.classList.contains('active'),
        computedPosition: window.getComputedStyle(submitButton).position,
        computedZIndex: window.getComputedStyle(submitButton).zIndex
      })
    }
    
    // NOW fade out form group (textarea area) - button is already fixed so won't be affected
    const formGroup = document.querySelector('.form-group') as HTMLElement
    if (formGroup) {
      formGroup.style.transition = 'opacity 0.3s ease-out'
      formGroup.style.opacity = '0'
    }
    
    // Move to animating phase (white screen)
    setPhase('animating')
    
    // Trigger button to bird animation IMMEDIATELY
    console.log('🚀 Starting button to bird animation on same screen', {
      hasButton: !!submitButtonRef.current,
      buttonRect: submitButtonRef.current?.getBoundingClientRect(),
      buttonHasActiveClass: submitButtonRef.current?.classList.contains('active'),
      buttonComputedOpacity: submitButtonRef.current ? window.getComputedStyle(submitButtonRef.current).opacity : 'N/A'
    })
    // Start animation immediately - no delay
    setShowButtonAnimation(true)
    console.log('✅ showButtonAnimation set to true', {
      phase,
      hypothesis: !!hypothesis,
      showButtonAnimation: true
    })
    
    // In production, you would call your API here
    // For now, we'll use mock data
    console.log('🚀 Starting animation with hypothesis:', hypothesis)
  }

  const handleNewTurn = () => {
    setPhase('input')
    setHypothesis('')
    setCharCount(0)
    setIsSubmitting(false)
    setParticlesFormed(false)
    setFinalText('')
    setShowButtonAnimation(false)
    setShowBirdFlocking(false)
    setLiteraryForm('')
    
    // Reset button to initial state
    if (submitButtonRef.current) {
      const button = submitButtonRef.current
      button.classList.remove('active')
      button.style.opacity = ''
      button.style.visibility = ''
      button.style.display = ''
      button.style.pointerEvents = ''
      button.style.zIndex = ''
      button.style.position = ''
      // Clear all CSS custom properties
      button.style.removeProperty('--plane-opacity')
      button.style.removeProperty('--text-opacity')
      button.style.removeProperty('--border-radius')
      button.style.removeProperty('--rotate')
      button.style.removeProperty('--plane-x')
      button.style.removeProperty('--plane-y')
    }
    
    // Clear sessionStorage
    sessionStorage.removeItem('buttonPosition')
    sessionStorage.removeItem('buttonToBirdComplete')
  }

  return (
    <div className="animation-page" style={{ 
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '201px 1fr',
      background: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Header Bar */}
      <header className="top-header">
        <h1 
          className="site-title" 
          onClick={phase !== 'input' ? handleNewTurn : undefined}
          style={{ cursor: phase !== 'input' ? 'pointer' : 'default' }}
        >
          VOLTA
        </h1>
        <div className="header-right">
          <span 
            ref={aboutTriggerRef}
            className="header-link" 
            onClick={() => setIsAboutOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            ABOUT
          </span>
          <AboutModal 
            isOpen={isAboutOpen} 
            onClose={() => setIsAboutOpen(false)}
            triggerElement={aboutTriggerRef.current}
          />
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <div 
            className={`nav-section ${phase === 'input' ? 'active' : ''}`}
            onClick={phase !== 'input' ? handleNewTurn : undefined}
            style={{ cursor: phase !== 'input' ? 'pointer' : 'default' }}
          >
            <span className="nav-number">001</span>
            <span className="nav-label">INPUT</span>
          </div>
          <div className={`nav-section ${phase === 'animating' ? 'active' : ''}`}>
            <span className="nav-number">002</span>
            <span className="nav-label">LOADING</span>
          </div>
          <div className={`nav-section ${phase === 'output' ? 'active' : ''}`}>
            <span className="nav-number">003</span>
            <span className="nav-label">OUTPUT</span>
          </div>
        </nav>
      </aside>

      {/* Bottom Left - Timestamp */}
      <div className="bottom-left">
        {new Date().toLocaleTimeString('en-US', { hour12: false })}
      </div>

      {/* Bottom Right - Character Count / Loading / Form Type */}
      <div className="bottom-right">
        {phase === 'input' && (
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
        )}
        {phase === 'animating' && (
          <div className="loading-status">
            <div className="progress-bar-container">
              <div className="progress-bar" />
            </div>
            <span>Loading Content</span>
          </div>
        )}
        {phase === 'output' && literaryForm && (
          <span>{literaryForm}</span>
        )}
      </div>
      
      {/* Input Form - Keep visible during button morphing animation */}
      {/* The button needs to stay in the DOM and visible for the CSS morphing to work */}
      {/* CRITICAL: Don't use AnimatePresence/motion.div opacity on the container - it interferes with button animation */}
      <AnimatePresence mode="wait">
        {(phase === 'input' || (phase === 'animating' && !showBirdFlocking)) && (
          <motion.div 
            className="input-container"
            initial={{ opacity: 1 }}
            animate={{ opacity: phase === 'input' ? 1 : 1 }} // Keep at 1 - we'll fade form-group separately
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ 
              pointerEvents: phase === 'input' ? 'auto' : 'none',
              // Don't apply opacity to container - it affects fixed button
              isolation: 'isolate' // Create new stacking context
            }}
          >
            <form onSubmit={handleSubmit} className="input-form">
              <div className="form-group">
                <label htmlFor="hypothesis">
                  TRANSFORM YOUR HYPOTHESIS INTO A WORK OF ART
                </label>
                <div className={`textarea-wrapper ${isFocused ? 'focused' : ''}`}>
                  <textarea
                    ref={textareaRef}
                    id="hypothesis"
                    value={hypothesis}
                    onChange={(e) => {
                      const newValue = e.target.value.slice(0, 300) // Enforce 300 char limit
                      setHypothesis(newValue)
                      setCharCount(newValue.length)
                    }}
                    onPaste={(e) => {
                      // Prevent default paste, then handle it manually to enforce limit
                      e.preventDefault()
                      const pastedText = e.clipboardData.getData('text')
                      const currentText = hypothesis
                      const combinedText = currentText + pastedText
                      const newValue = combinedText.slice(0, 300) // Enforce 300 char limit
                      setHypothesis(newValue)
                      setCharCount(newValue.length)
                    }}
                    onInput={(e) => {
                      // Additional enforcement for any input method
                      const target = e.target as HTMLTextAreaElement
                      if (target.value.length > 300) {
                        const newValue = target.value.slice(0, 300)
                        setHypothesis(newValue)
                        setCharCount(newValue.length)
                      }
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="e.g., If plants are given more sunlight, then they will grow taller..."
                    rows={5}
                    maxLength={300}
                    className="hypothesis-input"
                  />
                  <div className="input-glow" />
                </div>
              </div>

              <button 
                ref={submitButtonRef}
                type="submit" 
                className="submit-button"
                disabled={!hypothesis.trim() || isSubmitting}
              >
                <span className="default">Transform</span>
                <span className="success">Sent</span>
                <div className="left"></div>
                <div className="right"></div>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Button to bird animation - happens on same screen, no white div needed */}
      {/* The original button from the form will morph directly */}
      {/* Only render when animation should be active AND not yet completed */}
      {phase === 'animating' && hypothesis && showButtonAnimation && !showBirdFlocking && (
        <ButtonToBirdThreeJS
          buttonElement={submitButtonRef.current}
          hypothesis={hypothesis}
          onAnimationComplete={() => {
            console.log('✅ Button to bird animation complete')
          }}
          onBirdsFormed={() => {
            console.log('✅ Button bird animation complete - starting flocking animation')
            setShowBirdFlocking(true)
            // Unmount immediately since animation is complete
            setShowButtonAnimation(false)
          }}
        />
      )}

      {/* Bird Animation - Only show bird flocking and particle formation */}
      {/* Start after button animation completes - IMPORTANT: Don't render until button bird flies off */}
      {/* Keep this instance running even when phase changes to 'output' so particles stay visible */}
      {hypothesis && showBirdFlocking && (phase === 'animating' || phase === 'output') && (
        <ExplodingTextToBirds
          hypothesis={hypothesis}
          illustrationUrl={null}
          literaryText={phase === 'output' ? finalText : undefined}
          skipAnimation={false} // Keep animation running - particles are already formed
          skipExplosion={true} // Always skip explosion, using button animation instead
          onRevealComplete={() => {
            console.log('✅ Animation reveal complete')
          }}
          onOutputReady={() => {
            console.log('✅ Bird-to-particle transition started - particles forming')
          }}
          onParticlesFormed={() => {
            console.log('✅ Particles fully formed - moving to output phase')
            setParticlesFormed(true)
            // Mock final text - in production this would come from API
            setFinalText(`In gardens where the sunlight falls,
A seed awaits its gentle calls.
Through soil and rain, it finds its way,
Reaching upward toward the day.

Each photon caught, a gift of light,
Transforms the dark into the bright.
The stem ascends, the leaves unfold,
A story written, green and bold.

For every ray that touches earth,
Another inch of verdant birth.
The hypothesis, now proven true:
More light brings forth a taller view.`)
            // Set literary form type - in production this would come from API
            setLiteraryForm('SONNET')
            // Move to output phase after particles are formed
            setTimeout(() => {
              setPhase('output')
            }, 2000) // Wait 2 seconds to see the art
          }}
          onFlightBegins={() => {
            console.log('✈️ Birds taking flight')
          }}
        />
      )}

      {/* Content Container - Single scrollable layout with art above text */}
      {/* Show text overlay when in output phase - particles stay visible from ExplodingTextToBirds */}
      <AnimatePresence>
        {phase === 'output' && particlesFormed && finalText && (
          <motion.div
            className="output-content-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            style={{
              position: 'fixed',
              top: '80px', // Below header
              left: '201px', // Account for sidebar
              right: 0,
              bottom: 0,
              zIndex: 110, // Above the WebGL canvas (z-index 100) so text appears on top
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              pointerEvents: 'auto', // Enable scrolling anywhere on the page
              background: 'transparent', // Transparent so art shows through in art area
              overflowY: 'auto', // Enable scrolling for entire content
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
            }}
          >
            {/* Art area - transparent spacer so WebGL shows through */}
            <div style={{
              width: '100%',
              height: '80vh', // Give art most of viewport, text starts below
              minHeight: '80vh',
              flexShrink: 0,
              pointerEvents: 'none' // Allow clicks to pass through to WebGL
            }} />
            
            {/* Text content - Sits cleanly below the art with white background */}
            <div style={{
              width: '100%',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: '3rem 0 6rem 0', // Padding for text area - space above text
              marginTop: '0',
              pointerEvents: 'auto', // Enable text selection and interaction
              background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 10%, rgb(255,255,255) 20%)', // Gradient fade from transparent to white
              minHeight: 'auto' // Let content determine height
            }}>
              <div className="final-text" style={{
                width: '100%',
                maxWidth: '800px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '1rem',
                fontWeight: 400,
                lineHeight: 1.8,
                color: '#000000',
                textAlign: 'center',
                padding: '0 2rem',
                margin: '0 auto',
                position: 'relative',
                whiteSpace: 'pre-line', // Preserve line breaks
                background: 'transparent' // Let parent gradient show through
              }}>
                {finalText}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AnimationPage

