import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import '../styles/CustomCursor.css'

interface CustomCursorProps {
  type?: 'default' | 'plus' | 'minus'
}

function CustomCursor({ type = 'default' }: CustomCursorProps) {
  const cursorWrapperRef = useRef<HTMLDivElement>(null)
  const outerCursorRef = useRef<HTMLDivElement>(null)
  const innerCursorRef = useRef<HTMLDivElement>(null)
  const clientXRef = useRef(0)
  const clientYRef = useRef(0)
  const isOverInputRef = useRef(false)

  useEffect(() => {
    // Hide default cursor
    document.body.style.cursor = 'none'

    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      clientXRef.current = e.clientX
      clientYRef.current = e.clientY

      // Check if mouse is over an input element
      const elementBelow = document.elementFromPoint(e.clientX, e.clientY)
      const isInputElement = elementBelow && (
        elementBelow.tagName === 'INPUT' ||
        elementBelow.tagName === 'TEXTAREA' ||
        elementBelow.tagName === 'SELECT' ||
        (elementBelow instanceof HTMLElement && elementBelow.isContentEditable) ||
        elementBelow.closest('input, textarea, select, [contenteditable="true"]')
      )

      if (isInputElement && !isOverInputRef.current) {
        // Just entered an input element - hide custom cursor
        isOverInputRef.current = true
        if (cursorWrapperRef.current) {
          cursorWrapperRef.current.style.opacity = '0'
        }
        document.body.style.cursor = ''
      } else if (!isInputElement && isOverInputRef.current) {
        // Just left an input element - show custom cursor
        isOverInputRef.current = false
        if (cursorWrapperRef.current) {
          cursorWrapperRef.current.style.opacity = '1'
        }
        document.body.style.cursor = 'none'
      }
    }

    // Initialize cursor position to center of screen if mouse hasn't moved yet
    if (clientXRef.current === 0 && clientYRef.current === 0) {
      clientXRef.current = window.innerWidth / 2
      clientYRef.current = window.innerHeight / 2
    }

    document.addEventListener('mousemove', handleMouseMove)

    // Animate cursor position
    const render = () => {
      if (cursorWrapperRef.current) {
        gsap.set(cursorWrapperRef.current, {
          x: clientXRef.current,
          y: clientYRef.current,
        })
      }
      requestAnimationFrame(render)
    }
    requestAnimationFrame(render)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.body.style.cursor = ''
    }
  }, [])

  useEffect(() => {
    if (!outerCursorRef.current || !innerCursorRef.current) return

    const fullCursorSize = 40
    const defaultSize = 6

    if (type === 'default') {
      // Small dot
      gsap.to(outerCursorRef.current, {
        width: defaultSize,
        height: defaultSize,
        backgroundColor: '#ffffff',
        borderColor: '#ffffff',
        duration: 0.3,
        ease: 'back.out(1.7)',
      })
      innerCursorRef.current.classList.remove('is-closing')
      innerCursorRef.current.style.opacity = '0'
    } else if (type === 'plus') {
      // Circle with plus sign
      gsap.to(outerCursorRef.current, {
        width: fullCursorSize,
        height: fullCursorSize,
        backgroundColor: 'transparent',
        borderColor: '#ffffff',
        duration: 0.3,
        ease: 'back.out(1.7)',
      })
      innerCursorRef.current.classList.remove('is-closing')
      innerCursorRef.current.style.opacity = '1'
    } else if (type === 'minus') {
      // Circle with minus sign
      gsap.to(outerCursorRef.current, {
        width: fullCursorSize,
        height: fullCursorSize,
        backgroundColor: 'transparent',
        borderColor: '#ffffff',
        duration: 0.3,
        ease: 'back.out(1.7)',
      })
      innerCursorRef.current.classList.add('is-closing')
      innerCursorRef.current.style.opacity = '1'
    }
  }, [type])

  return (
    <div 
      ref={cursorWrapperRef} 
      className="cursor-wrapper"
      style={{ 
        visibility: 'visible',
        opacity: 1 
      }}
    >
      <div ref={outerCursorRef} className="custom-cursor custom-cursor__outer">
        <div ref={innerCursorRef} className="custom-cursor custom-cursor__inner"></div>
      </div>
    </div>
  )
}

export default CustomCursor

