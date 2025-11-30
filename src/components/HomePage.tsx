import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import CircularArrowButton from './CircularArrowButton'
import '../styles/HomePage.css'

interface HomePageProps {
  hypothesis: string
  onHypothesisChange: (hypothesis: string) => void
  onSubmit: () => void
  onReadMore: () => void
}

function HomePage({ hypothesis, onHypothesisChange, onSubmit, onReadMore }: HomePageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const instructionsRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const aboutLinkRef = useRef<HTMLSpanElement>(null)
  const aboutLinkContainerRef = useRef<HTMLDivElement>(null)

  // Animate elements on mount
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    // Animate VOLTA title - fade in and slide down
    if (titleRef.current) {
      gsap.set(titleRef.current, { opacity: 0, y: -30 })
      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 1,
      })
    }

    // Animate instructions - fade in with slight delay
    if (instructionsRef.current) {
      gsap.set(instructionsRef.current, { opacity: 0, y: 20 })
      tl.to(
        instructionsRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
        },
        '-=0.6'
      )
    }

    // Animate form elements - fade in
    if (formRef.current) {
      const formElements = formRef.current.querySelectorAll('.textarea-wrapper, .char-count')
      gsap.set(formElements, { opacity: 0, y: 20 })
      tl.to(
        formElements,
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
        },
        '-=0.4'
      )
    }

    // Animate CircularArrowButton - fade in and scale
    const button = formRef.current?.querySelector('.circular-arrow-button')
    if (button) {
      gsap.set(button, { opacity: 0, scale: 0.8 })
      tl.to(
        button,
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
        },
        '-=0.3'
      )
    }

    // Animate "Read About Me" link - fade in from bottom
    if (aboutLinkRef.current) {
      gsap.set(aboutLinkRef.current, { opacity: 0, y: 20 })
      tl.to(
        aboutLinkRef.current,
        {
          opacity: 0.7,
          y: 0,
          duration: 0.6,
        },
        '-=0.2'
      )
    }
  }, [])

  // Align "Read About Me" link with bottom of circular button
  useEffect(() => {
    const updateLinkPosition = () => {
      if (!formRef.current || !aboutLinkContainerRef.current) return
      
      const button = formRef.current.querySelector('.circular-arrow-button') as HTMLElement
      if (button) {
        const buttonRect = button.getBoundingClientRect()
        const containerRect = formRef.current.closest('.home-container')?.getBoundingClientRect()
        if (containerRect) {
          // Calculate position relative to container
          // Move up by 16px and adjust right position
          const buttonBottom = buttonRect.bottom - containerRect.top - 16 // Move up 16px
          aboutLinkContainerRef.current.style.top = `${buttonBottom}px`
        }
      }
    }

    // Update on mount and resize
    updateLinkPosition()
    window.addEventListener('resize', updateLinkPosition)
    
    // Also update after a short delay to ensure layout is settled
    const timeoutId = setTimeout(updateLinkPosition, 100)

    return () => {
      window.removeEventListener('resize', updateLinkPosition)
      clearTimeout(timeoutId)
    }
  }, [hypothesis]) // Recalculate when hypothesis changes (affects button state)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (hypothesis.trim()) {
      onSubmit()
    } else {
      // Shake animation for empty input
      if (textareaRef.current) {
        textareaRef.current.classList.add('shake')
        setTimeout(() => {
          textareaRef.current?.classList.remove('shake')
        }, 500)
      }
    }
  }
  
  const handleButtonClick = () => {
    if (hypothesis.trim()) {
      onSubmit()
    }
  }


  return (
    <div className="home-page">
      <div className="home-container">
        {/* VOLTA title at top */}
        <h1 ref={titleRef} className="home-title">VOLTA</h1>

        {/* Main content area - two columns */}
        <div className="home-content">
          {/* Right side - text input and forward arrow */}
          <div className="home-right">
            <form ref={formRef} onSubmit={handleSubmit} className="home-form">
              <div className="form-group">
                <p ref={instructionsRef} className="home-instructions">
                  ENTER A SCIENTIFIC HYPOTHESIS.<br />
                  RE-IMAGINE IT IN LITERARY FORM.
                </p>
                <div className="textarea-wrapper">
                  <textarea
                    ref={textareaRef}
                    id="hypothesis"
                    className="hypothesis-input"
                    value={hypothesis}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.length <= 300) {
                        onHypothesisChange(value)
                      }
                    }}
                    placeholder="Enter your hypothesis here..."
                    rows={3}
                    maxLength={300}
                  />
                  <div className="char-count">
                    {hypothesis.length}/300
                  </div>
                </div>
                <CircularArrowButton 
                  onClick={handleButtonClick}
                  disabled={!hypothesis.trim()}
                />
              </div>
            </form>
          </div>
        </div>

        {/* Read About Me link at bottom right */}
        <div ref={aboutLinkContainerRef} className="home-about-link">
          <span 
            ref={aboutLinkRef}
            className="read-about-link"
            onClick={onReadMore}
          >
            Read About Me
          </span>
        </div>
      </div>
    </div>
  )
}

export default HomePage

