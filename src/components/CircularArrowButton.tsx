import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import '../styles/CircularArrowButton.css'

interface CircularArrowButtonProps {
  onClick: () => void
  direction?: 'forward' | 'back' // New prop for arrow direction
  position?: 'default' | 'top-left' // New prop for positioning
  disabled?: boolean
}

function CircularArrowButton({ onClick, direction = 'forward', position = 'default', disabled = false }: CircularArrowButtonProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLButtonElement>(null)
  const textGroupsRef = useRef<SVGGElement[]>([])
  const rotationTweensRef = useRef<Array<{ kill: () => void }>>([])
  const [isHovering, setIsHovering] = useState(false)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return

    const svg = svgRef.current
    
    // Clear previous content
    svg.innerHTML = ''
    textGroupsRef.current = []

    const text = direction === 'forward' 
      ? 'TURN  •  TRANSFORM  •  ' 
      : 'GO  •  BACK  •  ' // Text for back arrow
    const centerX = 60
    const centerY = 60
    
    // Create 2 concentric circles
    // Adjust font size for back button to make text smaller and repeat more
    const baseFontSize = direction === 'back' ? 8 : 9 // Smaller for back button
    const outerFontSize = direction === 'back' ? 10 : 11 // Smaller for back button
    
    const circles = [
      { 
        radius: 40, // Inner circle
        fontSize: baseFontSize,
        id: 'circle-1',
        dir: -1 // Counterclockwise
      },
      { 
        radius: 50, // Outer circle
        fontSize: outerFontSize,
        id: 'circle-2',
        dir: 1 // Clockwise
      },
    ]

    circles.forEach((circle) => {
      // Create group positioned at center
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('transform', `translate(${centerX}, ${centerY})`)
      group.classList.add('circular-text-group')
      textGroupsRef.current.push(group)

      // Create circular path
      const pathId = circle.id
      const circlePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const d = `M ${-circle.radius},0 A ${circle.radius},${circle.radius} 0 1,1 ${circle.radius},0 A ${circle.radius},${circle.radius} 0 1,1 ${-circle.radius},0`
      circlePath.setAttribute('d', d)
      circlePath.setAttribute('id', pathId)
      circlePath.setAttribute('fill', 'none')
      circlePath.setAttribute('stroke', 'none')
      group.appendChild(circlePath)

      // Create text element
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      textElement.setAttribute('fill', '#FFFFFF')
      textElement.setAttribute('font-family', 'Josefin Sans, sans-serif')
      textElement.setAttribute('font-size', circle.fontSize.toString())
      textElement.setAttribute('font-weight', '400')
      textElement.setAttribute('text-transform', 'uppercase')
      textElement.setAttribute('letter-spacing', '0.1em') // Add letter spacing to prevent overlap

      // Calculate how many times to repeat text to fill the circle
      // Use more accurate character width calculation with letter spacing
      const circumference = 2 * Math.PI * circle.radius
      const charWidth = circle.fontSize * 0.65 + 0.1 * circle.fontSize // Account for letter spacing
      const textLength = text.length
      const textWidth = textLength * charWidth
      
      // Calculate how many full repeats we need to fill the circle
      // For back button, use more repeats to match visual density of forward button
      const baseRepeats = Math.floor(circumference / textWidth)
      // For back button, add extra repeats to make it look similar to forward button
      const targetRepeats = direction === 'back' 
        ? Math.max(4, baseRepeats + 2) // More repeats for shorter text
        : baseRepeats
      // Ensure we have an even number of complete segments for symmetry
      const evenRepeats = targetRepeats % 2 === 0 ? targetRepeats : targetRepeats - 1
      const repeats = Math.max(2, evenRepeats)
      
      // Create repeated text with only complete segments
      let repeatedText = text.repeat(repeats)
      
      // Critical: Ensure we end at a complete text segment boundary
      // The text should always end with the full pattern, not mid-word
      // Find the last complete occurrence of our text pattern
      const textPattern = text.trim() // "TURN  •  TRANSFORM" or "GO  •  BACK"
      
      // Find where the last complete text segment ends
      // We need to find the position where we have a complete text pattern followed by "  •  "
      const searchPattern = textPattern + '  •  '
      let lastCompletePos = repeatedText.lastIndexOf(searchPattern)
      
      if (lastCompletePos === -1) {
        // Fallback: find last complete text pattern
        lastCompletePos = repeatedText.lastIndexOf(textPattern)
        if (lastCompletePos >= 0) {
          // End right after the complete pattern
          repeatedText = repeatedText.substring(0, lastCompletePos + textPattern.length)
        }
      } else {
        // End after the complete pattern with its separator
        repeatedText = repeatedText.substring(0, lastCompletePos + searchPattern.length)
      }
      
      // Use textLength to force even distribution around the circle
      // This ensures perfect symmetry by stretching text to fill the entire path
      // When using textLength, we don't need startOffset as the text will fill the path evenly
      const textLengthValue = circumference

      const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
      textPath.setAttribute('href', `#${pathId}`)
      textPath.setAttribute('startOffset', '0%') // Start at the beginning for symmetry
      textPath.setAttribute('textLength', textLengthValue.toString())
      textPath.setAttribute('lengthAdjust', 'spacingAndGlyphs') // Adjust spacing to fill evenly
      textPath.textContent = repeatedText

      textElement.appendChild(textPath)
      group.appendChild(textElement)
      svg.appendChild(group)

      // Set transform origin for rotation (relative to group's origin at 0,0)
      gsap.set(group, { 
        transformOrigin: '0px 0px'
      })
    })

    // Set SVG dimensions
    svg.setAttribute('width', '120')
    svg.setAttribute('height', '120')
    svg.setAttribute('viewBox', '0 0 120 120')
  }, [direction]) // Re-run effect if direction changes

  // Handle rotation on hover or click (like landing page)
  useEffect(() => {
    if (textGroupsRef.current.length === 0) return

    // Kill any existing animations
    rotationTweensRef.current.forEach(tween => tween?.kill())
    rotationTweensRef.current = []

    const centerX = 60
    const centerY = 60

    if (isHovering || isActive) {
      // Rotate circles continuously in opposite directions
      textGroupsRef.current.forEach((group, index) => {
        const circle = index === 0 
          ? { radius: 40, dir: -1 } // Inner circle - counterclockwise
          : { radius: 50, dir: 1 }  // Outer circle - clockwise
        
        // Get current rotation from transform attribute
        const currentTransform = group.getAttribute('transform') || `translate(${centerX}, ${centerY})`
        let currentRotation = 0
        const rotationMatch = currentTransform.match(/rotate\(([^)]+)\)/)
        if (rotationMatch) {
          currentRotation = parseFloat(rotationMatch[1]) || 0
        }
        
        // Create continuous rotation animation
        const tween = gsap.to({ rotation: currentRotation }, {
          duration: 4,
          ease: 'none', // Linear for continuous rotation
          rotation: `+=${circle.dir * 360}`, // Rotate 360 degrees in the circle's direction
          repeat: -1, // Continuous rotation
          onUpdate: function() {
            const rotation = (this.targets()[0] as any).rotation || 0
            // SVG transform: translate to center, then rotate around origin (0,0)
            group.setAttribute('transform', `translate(${centerX}, ${centerY}) rotate(${rotation})`)
          }
        })
        rotationTweensRef.current.push(tween)
      })
    } else {
      // Reset to original position when not hovering/active
      textGroupsRef.current.forEach((group) => {
        group.setAttribute('transform', `translate(${centerX}, ${centerY})`)
      })
    }

    return () => {
      rotationTweensRef.current.forEach(tween => tween?.kill())
      rotationTweensRef.current = []
    }
  }, [isHovering, isActive])

  const handleClick = () => {
    if (disabled) return
    setIsActive(true)
    setTimeout(() => setIsActive(false), 2000) // Rotate for 2 seconds on click
    onClick()
  }

  return (
    <button 
      ref={containerRef}
      className={`circular-arrow-button ${position === 'top-left' ? 'circular-arrow-button-top-left' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      disabled={disabled}
      type="button"
    >
      <svg ref={svgRef} className="circular-arrow-svg" />
      <span className="center-arrow">{direction === 'forward' ? '→' : '←'}</span>
    </button>
  )
}

export default CircularArrowButton

