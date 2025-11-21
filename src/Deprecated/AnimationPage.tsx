import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ExplodingTextToBirds from './ExplodingTextToBirds'
import ButtonToBirdThreeJS from './ButtonToBirdThreeJS'
import AboutModal from '../components/AboutModal'
import InfoPopover from './InfoPopover'
import CustomSelect from './CustomSelect'
import { generateText, LITERARY_FORMS, type LiteraryForm } from '../services/textGeneration'
import { generateImage } from '../services/imageGeneration'
import './InputPage.css'
import './LoadingPage.css'
import './OutputPage.css'

type AnimationPhase = 'input' | 'animating' | 'output'

function AnimationPage() {
  const [hypothesis, setHypothesis] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [selectedLiteraryForm, setSelectedLiteraryForm] = useState<LiteraryForm>('short_poem')
  const [artBottomEdgeVh, setArtBottomEdgeVh] = useState(75) // Dynamic position of art bottom edge in vh (default 75vh)

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
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null)
  const [particlesFormed, setParticlesFormed] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [showButtonAnimation, setShowButtonAnimation] = useState(false)
  const [showBirdFlocking, setShowBirdFlocking] = useState(false)
  const [literaryForm, setLiteraryForm] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aboutTriggerRef = useRef<HTMLSpanElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const htmlAnimationHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const lockedButtonPositionRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  
  // Store API results in refs to avoid state updates during animation
  const apiResultsRef = useRef<{
    text: string | null
    form: string | null
    imageUrl: string | null
  }>({ text: null, form: null, imageUrl: null })

  // Attach HTML's click handler directly to button (runs immediately on click, like HTML version)
  useEffect(() => {
    const button = submitButtonRef.current
    if (!button) return

    const handleButtonClick = async (e: MouseEvent) => {
      // Only run if button doesn't already have 'active' class
      // (This matches the HTML's check: if(!button.classList.contains('active')))
      if (!button.classList.contains('active') && !isSubmitting && hypothesis.trim()) {
        console.log('🎯 Button clicked - setting up for animation')
        
        // Prevent form submission (we'll handle it separately)
        e.preventDefault()
        e.stopPropagation()
        
        // CRITICAL: Lock button position IMMEDIATELY - BEFORE any other changes
        // Capture position from viewport to prevent any layout shifts
        const buttonRect = button.getBoundingClientRect()
        
        // Store the locked position in a ref so useEffect can use it
        lockedButtonPositionRef.current = {
          left: buttonRect.left,
          top: buttonRect.top,
          width: buttonRect.width,
          height: buttonRect.height
        }
        
        // Lock position SYNCHRONOUSLY with !important - do this FIRST, before ANY other changes
        button.style.setProperty('position', 'fixed', 'important')
        button.style.setProperty('left', `${buttonRect.left}px`, 'important')
        button.style.setProperty('top', `${buttonRect.top}px`, 'important')
        button.style.setProperty('width', `${buttonRect.width}px`, 'important')
        button.style.setProperty('height', `${buttonRect.height}px`, 'important')
        button.style.setProperty('margin', '0', 'important')
        button.style.setProperty('padding', '8px 24px', 'important')
        button.style.setProperty('transform', 'none', 'important')
        button.style.setProperty('isolation', 'isolate', 'important')
        button.style.setProperty('will-change', 'opacity', 'important')
        button.style.setProperty('--rotate', '0', 'important')
        button.style.setProperty('--plane-x', '0', 'important')
        button.style.setProperty('--plane-y', '0', 'important')
        button.style.setProperty('z-index', '999999', 'important')
        
        // Force multiple reflows to ensure position is locked
        void button.offsetWidth
        void button.offsetHeight
        void button.getBoundingClientRect()
        
        // Verify position is locked before proceeding
        const verifyRect = button.getBoundingClientRect()
        if (verifyRect.left !== buttonRect.left || verifyRect.top !== buttonRect.top) {
          console.warn('⚠️ Button moved during lock! Re-locking...', {
            expected: { left: buttonRect.left, top: buttonRect.top },
            actual: { left: verifyRect.left, top: verifyRect.top }
          })
          button.style.setProperty('left', `${buttonRect.left}px`, 'important')
          button.style.setProperty('top', `${buttonRect.top}px`, 'important')
          void button.offsetWidth
        }
        
        // NOW add active class (after position is locked)
        button.classList.add('active')
        
        // Set submitting state (after position is locked)
        setIsSubmitting(true)
        
        // Set up continuous position monitoring with MutationObserver
        const observer = new MutationObserver(() => {
          if (button && lockedButtonPositionRef.current) {
            const currentRect = button.getBoundingClientRect()
            const lockedPos = lockedButtonPositionRef.current
            if (currentRect.left !== lockedPos.left || currentRect.top !== lockedPos.top) {
              console.warn('⚠️ Button position changed! Re-locking...', {
                expected: { left: lockedPos.left, top: lockedPos.top },
                actual: { left: currentRect.left, top: currentRect.top }
              })
              button.style.setProperty('left', `${lockedPos.left}px`, 'important')
              button.style.setProperty('top', `${lockedPos.top}px`, 'important')
            }
          }
        })
        
        observer.observe(button, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          childList: false,
          subtree: false
        })
        
        // Store observer for cleanup
        ;(button as any)._positionObserver = observer
        
        // Hide all form elements EXCEPT the button (which is fixed and isolated)
        // Don't hide the container itself - it might affect the button animation
        // Only hide the specific form elements inside
        
        // Hide all form groups (labels, inputs, selects)
        const formGroups = document.querySelectorAll('.form-group')
        formGroups.forEach((group) => {
          const el = group as HTMLElement
          el.style.transition = 'opacity 0.3s ease-out'
          el.style.opacity = '0'
          el.style.pointerEvents = 'none' // Prevent any interaction
        })
        
        // Hide textarea specifically
        if (textareaRef.current) {
          textareaRef.current.style.opacity = '0'
          textareaRef.current.style.transition = 'opacity 0.3s'
          textareaRef.current.style.pointerEvents = 'none'
        }
        
        // Hide all labels
        const labels = document.querySelectorAll('.form-group label')
        labels.forEach((label) => {
          const el = label as HTMLElement
          el.style.transition = 'opacity 0.3s ease-out'
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
        })
        
        // Hide all select elements and wrappers
        const selects = document.querySelectorAll('.literary-form-select, .select-wrapper')
        selects.forEach((select) => {
          const el = select as HTMLElement
          el.style.transition = 'opacity 0.3s ease-out'
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
        })
        
        // Hide textarea wrapper
        const textareaWrapper = document.querySelector('.textarea-wrapper')
        if (textareaWrapper) {
          const el = textareaWrapper as HTMLElement
          el.style.transition = 'opacity 0.3s ease-out'
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
        }
        
        // IMPORTANT: Don't hide the form or container - the button needs to stay visible
        // The button is already fixed-positioned and isolated, so it won't be affected
        
        // CRITICAL: Re-verify button position after hiding form elements
        // This ensures the button hasn't moved due to any layout shifts
        requestAnimationFrame(() => {
          if (button && lockedButtonPositionRef.current) {
            const currentRect = button.getBoundingClientRect()
            const lockedPos = lockedButtonPositionRef.current
            if (currentRect.left !== lockedPos.left || currentRect.top !== lockedPos.top) {
              console.warn('⚠️ Button moved after hiding form elements! Re-locking...', {
                expected: { left: lockedPos.left, top: lockedPos.top },
                actual: { left: currentRect.left, top: currentRect.top }
              })
              button.style.setProperty('left', `${lockedPos.left}px`, 'important')
              button.style.setProperty('top', `${lockedPos.top}px`, 'important')
              void button.offsetWidth
            }
          }
        })
        
        // Use multiple requestAnimationFrames to ensure position stays locked through re-renders
        requestAnimationFrame(() => {
          // Re-lock position before phase change
          if (button && lockedButtonPositionRef.current) {
            const lockedPos = lockedButtonPositionRef.current
            
            // Re-lock position
            button.style.setProperty('left', `${lockedPos.left}px`, 'important')
            button.style.setProperty('top', `${lockedPos.top}px`, 'important')
            void button.offsetWidth
            
            // Verify it's still correct
            const verifyRect = button.getBoundingClientRect()
            if (verifyRect.left !== lockedPos.left || verifyRect.top !== lockedPos.top) {
              console.warn('⚠️ Button position incorrect before phase change! Re-locking...', {
                expected: { left: lockedPos.left, top: lockedPos.top },
                actual: { left: verifyRect.left, top: verifyRect.top }
              })
              button.style.setProperty('left', `${lockedPos.left}px`, 'important')
              button.style.setProperty('top', `${lockedPos.top}px`, 'important')
              void button.offsetWidth
            }
          }
          
          requestAnimationFrame(() => {
            // Re-lock again, then change phase
            if (button && lockedButtonPositionRef.current) {
              const lockedPos = lockedButtonPositionRef.current
              
              // Re-lock position
              button.style.setProperty('left', `${lockedPos.left}px`, 'important')
              button.style.setProperty('top', `${lockedPos.top}px`, 'important')
              void button.offsetWidth
              
              // Final verification before phase change
              const verifyRect = button.getBoundingClientRect()
              if (verifyRect.left !== lockedPos.left || verifyRect.top !== lockedPos.top) {
                console.warn('⚠️ Button position incorrect on final check! Re-locking...', {
                  expected: { left: lockedPos.left, top: lockedPos.top },
                  actual: { left: verifyRect.left, top: verifyRect.top }
                })
                button.style.setProperty('left', `${lockedPos.left}px`, 'important')
                button.style.setProperty('top', `${lockedPos.top}px`, 'important')
                void button.offsetWidth
              }
            }
            
            // Update phase - ButtonToBirdThreeJS will handle the actual animation
            setPhase('animating')
            setShowButtonAnimation(true)
            
            // Start API calls immediately after state update - they run in parallel
            // Store results in refs to avoid further re-renders during animation
            console.log('🚀 Starting API calls in parallel with animation')
            ;(async () => {
              try {
                console.log('📡 Starting API calls for text and image generation')
                // Generate text first
                const textResult = await generateText(hypothesis, selectedLiteraryForm)
                // Store in ref instead of state to avoid re-render during animation
                apiResultsRef.current.text = textResult.text
                apiResultsRef.current.form = textResult.form
                
                // Then generate image from the generated text
                // Pass literary form to match original format from commit 0b80fee
                const imageUrl = await generateImage(textResult.text, window.innerWidth, window.innerHeight, selectedLiteraryForm)
                if (imageUrl) {
                  apiResultsRef.current.imageUrl = imageUrl
                }
                
                console.log('✅ API calls completed (stored in refs, will update state after animation)')
              } catch (error) {
                console.error('❌ Error generating content:', error)
                // Fall back to mock data if API fails
                const formConfig = LITERARY_FORMS.find(f => f.value === selectedLiteraryForm)
                apiResultsRef.current.form = formConfig?.label.toUpperCase() || 'LITERARY WORK'
              }
            })() // Fire and forget - runs in parallel, no state updates during animation
          })
        })
        
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
  }, [isSubmitting, hypothesis, selectedLiteraryForm])

  // CRITICAL: Re-lock button position immediately when phase changes to 'animating'
  // This prevents the button from moving during React re-renders
  useEffect(() => {
    if (phase === 'animating' && submitButtonRef.current?.classList.contains('active') && lockedButtonPositionRef.current) {
      const button = submitButtonRef.current
      const lockedPos = lockedButtonPositionRef.current
      
      // Use the ORIGINAL locked position, not the current position
      // This ensures the button stays exactly where it was when clicked
      button.style.setProperty('position', 'fixed', 'important')
      button.style.setProperty('left', `${lockedPos.left}px`, 'important')
      button.style.setProperty('top', `${lockedPos.top}px`, 'important')
      button.style.setProperty('width', `${lockedPos.width}px`, 'important')
      button.style.setProperty('height', `${lockedPos.height}px`, 'important')
      button.style.setProperty('margin', '0', 'important')
      button.style.setProperty('padding', '8px 24px', 'important')
      button.style.setProperty('transform', 'none', 'important')
      button.style.setProperty('will-change', 'opacity', 'important')
      
      // Force reflow to apply styles immediately
      void button.offsetWidth
      
      // Double-check after a frame to catch any delayed layout shifts
      requestAnimationFrame(() => {
        if (button && button.classList.contains('active') && lockedButtonPositionRef.current) {
          const currentRect = button.getBoundingClientRect()
          if (currentRect.left !== lockedPos.left || currentRect.top !== lockedPos.top) {
            console.warn('⚠️ Button moved during phase change! Re-locking with !important', {
              expected: { left: lockedPos.left, top: lockedPos.top },
              actual: { left: currentRect.left, top: currentRect.top }
            })
            button.style.setProperty('left', `${lockedPos.left}px`, 'important')
            button.style.setProperty('top', `${lockedPos.top}px`, 'important')
            void button.offsetWidth
          }
        }
      })
    }
  }, [phase])

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
    let lockedButtonRect: DOMRect | null = null
    if (submitButton) {
      const buttonRect = submitButton.getBoundingClientRect()
      lockedButtonRect = buttonRect // Store for later use
      
      // CRITICAL: Lock position BEFORE adding active class to prevent any movement
      // Use setProperty with important flag to override everything
      submitButton.style.setProperty('position', 'fixed', 'important')
      submitButton.style.setProperty('left', `${buttonRect.left}px`, 'important')
      submitButton.style.setProperty('top', `${buttonRect.top}px`, 'important')
      submitButton.style.setProperty('width', `${buttonRect.width}px`, 'important')
      submitButton.style.setProperty('height', `${buttonRect.height}px`, 'important')
      submitButton.style.setProperty('margin', '0', 'important')
      submitButton.style.setProperty('padding', '8px 24px', 'important')
      submitButton.style.setProperty('transform', 'none', 'important')
      submitButton.style.setProperty('--rotate', '0', 'important')
      submitButton.style.setProperty('--plane-x', '0', 'important')
      submitButton.style.setProperty('--plane-y', '0', 'important')
      submitButton.style.setProperty('isolation', 'isolate', 'important')
      submitButton.style.setProperty('will-change', 'opacity', 'important')
      
      // Force reflow to lock position
      void submitButton.offsetWidth
      
      // NOW add active class (CSS won't override our inline styles with !important)
      submitButton.classList.add('active')
      
      // Force another reflow after adding class
      void submitButton.offsetWidth
      
      // Verify position is still locked
      const finalRect = submitButton.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(submitButton)
      console.log('🔍 Button after submit - made active and fixed:', {
        initialLeft: buttonRect.left,
        initialTop: buttonRect.top,
        finalLeft: finalRect.left,
        finalTop: finalRect.top,
        moved: finalRect.left !== buttonRect.left || finalRect.top !== buttonRect.top,
        hasActiveClass: submitButton.classList.contains('active'),
        computedPosition: computedStyle.position,
        computedLeft: computedStyle.left,
        computedTop: computedStyle.top,
        computedTransform: computedStyle.transform,
        computedZIndex: computedStyle.zIndex,
        computedMargin: computedStyle.margin
      })
      
      // If button moved, force it back with !important
      if (finalRect.left !== buttonRect.left || finalRect.top !== buttonRect.top) {
        console.warn('⚠️ Button moved after locking! Forcing back to original position')
        submitButton.style.setProperty('left', `${buttonRect.left}px`, 'important')
        submitButton.style.setProperty('top', `${buttonRect.top}px`, 'important')
        void submitButton.offsetWidth
      }
      
      // Set up a MutationObserver to catch any style changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const currentRect = submitButton.getBoundingClientRect()
            if (lockedButtonRect && (currentRect.left !== lockedButtonRect.left || currentRect.top !== lockedButtonRect.top)) {
              console.warn('⚠️ Button style was modified! Re-locking position', {
                expected: { left: lockedButtonRect.left, top: lockedButtonRect.top },
                actual: { left: currentRect.left, top: currentRect.top }
              })
              submitButton.style.setProperty('left', `${lockedButtonRect.left}px`, 'important')
              submitButton.style.setProperty('top', `${lockedButtonRect.top}px`, 'important')
            }
          }
        })
      })
      
      observer.observe(submitButton, {
        attributes: true,
        attributeFilter: ['style', 'class']
      })
      
      // Store observer to clean up later
      ;(submitButton as any)._positionObserver = observer
    }
    
    // NOW fade out form group (textarea area) - button is already fixed so won't be affected
    const formGroup = document.querySelector('.form-group') as HTMLElement
    if (formGroup) {
      formGroup.style.transition = 'opacity 0.3s ease-out'
      formGroup.style.opacity = '0'
    }
    
    // CRITICAL: Prevent any scroll or layout shifts before phase change
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    
    // Move to animating phase (white screen) - button is already locked so won't move
    setPhase('animating')
    
    // CRITICAL: Re-lock button position after phase change to prevent any layout shifts
    // Use multiple requestAnimationFrame calls to catch any delayed re-renders
    if (submitButton && lockedButtonRect) {
      // First frame - immediate check
      requestAnimationFrame(() => {
        if (submitButton && lockedButtonRect) {
          // Restore scroll position if it changed
          if (window.scrollY !== scrollY) {
            window.scrollTo(scrollX, scrollY)
          }
          
          const currentRect = submitButton.getBoundingClientRect()
          if (currentRect.left !== lockedButtonRect.left || currentRect.top !== lockedButtonRect.top) {
            console.warn('⚠️ Button moved after phase change! Re-locking position', {
              expected: { left: lockedButtonRect.left, top: lockedButtonRect.top },
              actual: { left: currentRect.left, top: currentRect.top },
              scrollChanged: window.scrollY !== scrollY
            })
            submitButton.style.position = 'fixed'
            submitButton.style.left = `${lockedButtonRect.left}px`
            submitButton.style.top = `${lockedButtonRect.top}px`
            submitButton.style.setProperty('transform', 'none', 'important')
            void submitButton.offsetWidth
          }
        }
      })
      
      // Second frame - catch any delayed layout shifts
      requestAnimationFrame(() => {
        if (submitButton && lockedButtonRect) {
          const currentRect = submitButton.getBoundingClientRect()
          if (currentRect.left !== lockedButtonRect.left || currentRect.top !== lockedButtonRect.top) {
            console.warn('⚠️ Button moved on second frame! Re-locking again')
            submitButton.style.position = 'fixed'
            submitButton.style.left = `${lockedButtonRect.left}px`
            submitButton.style.top = `${lockedButtonRect.top}px`
            submitButton.style.setProperty('transform', 'none', 'important')
            void submitButton.offsetWidth
          }
        }
      })
    }
    
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
    setIllustrationUrl(null)
    setShowButtonAnimation(false)
    setShowBirdFlocking(false)
    setLiteraryForm('')
    setSelectedLiteraryForm('short_poem')
    
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

      {/* Bottom Right - Character Count / Loading / Form Type */}
      <div className="bottom-right">
        {phase === 'input' && (
          <span style={{ color: charCount >= 300 ? '#ff4444' : 'inherit' }}>
            {charCount}/300 {charCount === 1 ? 'character' : 'characters'}
            {charCount >= 300 && ' (limit reached)'}
          </span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{literaryForm}</span>
            <InfoPopover
              position="top"
              content={
                <>
                  <p>
                    <strong>AI-Generated Content:</strong> The literary texts and images in Volta are generated using artificial intelligence.
                  </p>
                  <p>
                    <strong>Text Generation:</strong> Uses Hugging Face models including Gemma-2, Falcon, Phi-3.5, and Llama-3.
                  </p>
                  <p>
                    <strong>Image Generation:</strong> Uses Pollinations.AI with the Flux model.
                  </p>
                  <p>
                    Please note that AI-generated content may contain inaccuracies, biases, or unexpected interpretations.
                  </p>
                </>
              }
            />
          </div>
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
              isolation: 'isolate', // Create new stacking context
              // CRITICAL: Prevent any transforms that might affect fixed button
              transform: 'none !important',
              willChange: 'opacity' // Only opacity, not transform
            }}
          >
            <form onSubmit={handleSubmit} className="input-form">
              <div className="form-group">
                <label htmlFor="literary-form">
                  SELECT LITERARY FORM
                </label>
                <CustomSelect
                  id="literary-form"
                  value={selectedLiteraryForm}
                  onChange={setSelectedLiteraryForm}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hypothesis" style={{ display: 'flex', alignItems: 'center' }}>
                  TRANSFORM YOUR HYPOTHESIS INTO A WORK OF ART
                  <InfoPopover
                    position="top"
                    content={
                      <>
                        <p>
                          <strong>Try it:</strong> Enter a scientific hypothesis and watch it transform into poetry, song, or myth.
                        </p>
                        <p>
                          <strong>Examples:</strong>
                        </p>
                        <ul>
                          <li>"If I have green eyes and I have a child, my child will have green eyes"</li>
                          <li>"If I exercise regularly, my cardiovascular health will improve"</li>
                          <li>"If I go outside at night, I will see more stars when the Moon is not visible than when it is full"</li>
                        </ul>
                        <p>
                          <strong>Note:</strong> Content is AI-generated. It may take a moment for the text and image to appear.
                        </p>
                        <p>
                          Please note that AI-generated content may contain inaccuracies, biases, or unexpected interpretations.
                        </p>
                      </>
                    }
                  />
                </label>
                <div className={`textarea-wrapper ${isFocused ? 'focused' : ''}`}>
                  <textarea
                    ref={textareaRef}
                    id="hypothesis"
                    value={hypothesis}
                    maxLength={300}
                    onChange={(e) => {
                      const newValue = e.target.value.slice(0, 300) // Enforce 300 char limit
                      setHypothesis(newValue)
                      setCharCount(newValue.length)
                    }}
                    onKeyDown={(e) => {
                      // Prevent typing if at limit (except backspace, delete, arrow keys, etc.)
                      if (hypothesis.length >= 300 && 
                          !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(e.key) &&
                          !e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        // Show brief visual feedback that limit is reached
                        if (textareaRef.current) {
                          textareaRef.current.style.borderColor = '#ff4444'
                          setTimeout(() => {
                            if (textareaRef.current) {
                              textareaRef.current.style.borderColor = ''
                            }
                          }, 300)
                        }
                      }
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
                      // Manually update the textarea value to ensure it's set
                      if (textareaRef.current) {
                        textareaRef.current.value = newValue
                        // Show visual feedback if text was trimmed
                        if (combinedText.length > 300) {
                          textareaRef.current.style.borderColor = '#ff4444'
                          setTimeout(() => {
                            if (textareaRef.current) {
                              textareaRef.current.style.borderColor = ''
                            }
                          }, 500)
                        }
                      }
                    }}
                    onInput={(e) => {
                      // Additional enforcement for any input method
                      const target = e.target as HTMLTextAreaElement
                      if (target.value.length > 300) {
                        const newValue = target.value.slice(0, 300)
                        setHypothesis(newValue)
                        setCharCount(newValue.length)
                        target.value = newValue // Force update
                      }
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setIsFocused(false)
                      // Ensure value is still within limit on blur
                      if (hypothesis.length > 300) {
                        const trimmed = hypothesis.slice(0, 300)
                        setHypothesis(trimmed)
                        setCharCount(300)
                      }
                    }}
                    placeholder="e.g., If plants are given more sunlight, then they will grow taller..."
                    rows={5}
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
            
            // NOW update state from refs - animation is complete, safe to trigger re-renders
            // API calls already happened in parallel, we just need to update state now
            if (apiResultsRef.current.text) {
              setFinalText(apiResultsRef.current.text)
            }
            if (apiResultsRef.current.form) {
              setLiteraryForm(apiResultsRef.current.form)
            }
            if (apiResultsRef.current.imageUrl) {
              setIllustrationUrl(apiResultsRef.current.imageUrl)
            }
            console.log('✅ State updated from API results (animation already complete)')
          }}
        />
      )}

      {/* Bird Animation - Only show bird flocking and particle formation */}
      {/* Start after button animation completes - IMPORTANT: Don't render until button bird flies off */}
      {/* Keep this instance running even when phase changes to 'output' so particles stay visible */}
      {hypothesis && showBirdFlocking && (phase === 'animating' || phase === 'output') && (
        <ExplodingTextToBirds
          hypothesis={hypothesis}
          illustrationUrl={illustrationUrl}
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
            // Move to output phase after particles are formed
            // Text and image should already be set from API calls
            setTimeout(() => {
              setPhase('output')
            }, 2000) // Wait 2 seconds to see the art
          }}
          onFlightBegins={() => {
            console.log('✈️ Birds taking flight')
          }}
          onArtBoundsCalculated={(bottomEdgeVh) => {
            console.log(`📐 Art bottom edge: ${bottomEdgeVh.toFixed(1)}vh from container top`)
            setArtBottomEdgeVh(bottomEdgeVh)
            // Force Safari repaint to ensure height updates properly
            if (typeof window !== 'undefined') {
              // Use double RAF for Safari to ensure proper repaint
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  // Force a reflow in Safari by reading layout properties
                  const outputContainer = document.querySelector('.output-content-container')
                  if (outputContainer) {
                    void (outputContainer as HTMLElement).offsetHeight
                  }
                })
              })
            }
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
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              // Prevent scrolling past content - limit to actual content height
              maxHeight: 'calc(100vh - 80px)' // Match viewport height minus header
            }}
          >
            {/* Art area - transparent spacer so WebGL shows through */}
            {/* Spacer height = exact bottom edge of centered art */}
            {/* Direct vh value works better in Safari than CSS variables */}
            <div 
              style={{
                width: '100%',
                height: `${artBottomEdgeVh}vh`, // Direct vh value for Safari compatibility
                minHeight: `${artBottomEdgeVh}vh`,
                flexShrink: 0,
                pointerEvents: 'none', // Allow clicks to pass through to WebGL
                transition: 'height 0.3s ease-out',
                WebkitTransition: 'height 0.3s ease-out', // Safari prefix
                willChange: 'height', // Optimize for Safari
                WebkitBackfaceVisibility: 'hidden', // Safari rendering optimization
                backfaceVisibility: 'hidden'
              } as React.CSSProperties}
            />
            
            {/* Text content - Sits cleanly below the art with white background */}
            {/* Use transform instead of negative margin for Safari compatibility */}
            <div style={{
              width: '100%',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: '4rem 0 4rem 0', // Reduced bottom padding to prevent excessive white space
              marginTop: '0', // No negative margin - use transform instead for Safari
              transform: 'translateY(-6rem)', // Move up more to start gradient higher
              WebkitTransform: 'translateY(-6rem)', // Safari prefix
              pointerEvents: 'auto', // Enable text selection and interaction
              background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 8%, rgba(255,255,255,0.85) 15%, rgb(255,255,255) 22%, rgb(255,255,255) 100%)', // Gradient starts higher, then solid white all the way down
              WebkitBackgroundClip: 'padding-box', // Safari gradient fix
              backgroundClip: 'padding-box',
              minHeight: 'auto', // Let content determine height, don't force full viewport
              position: 'relative' // Ensure it covers content below
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

