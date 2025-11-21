import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './CircularLandingPage.css'

interface CircularLandingPageProps {
  onEnter: () => void
}

export default function CircularLandingPage({ onEnter }: CircularLandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const textGroupsRef = useRef<SVGGElement[]>([])
  const rotationTweensRef = useRef<Array<{ kill: () => void }>>([])
  const [isHovering, setIsHovering] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)

  // Create multiple concentric text circles
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return

    const svg = svgRef.current
    
    // Clear previous content
    svg.innerHTML = ''
    textGroupsRef.current = []

    // Full sentence that wraps around
    const sentence = 'VOLTA TRANSFORMS SCIENTIFIC HYPOTHESES INTO NARRATIVE FORMS • SONNET MYTH SONG POETRY EPIC FAIRYTALE PROVERB • BEGIN A TRANSFORMATION • TURN SHIFT PERSPECTIVE • LITERARY METAPHOR STORY • '

    const centerX = 400
    const centerY = 400
    
    // Create 4 concentric circles with different radii, fonts, sizes, and weights (like Codrops)
    // Alternating between Aerisa (elegant serif) and simple sans-serif
    const circles = [
      { 
        radius: 160, // Innermost (closest to button)
        fontSize: 24, // Smallest font
        fontFamily: 'Aerisa, Cormorant Garamond, serif', // Elegant serif
        fontWeight: 400,
        fill: 'rgba(212, 165, 116, 0.95)',
        id: 'circle-1' 
      },
      { 
        radius: 190, 
        fontSize: 28, 
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif', // Simple sans-serif
        fontWeight: 300,
        fill: 'rgba(212, 165, 116, 0.9)',
        id: 'circle-2' 
      },
      { 
        radius: 220, 
        fontSize: 32, 
        fontFamily: 'Aerisa, Cormorant Garamond, serif', // Elegant serif
        fontWeight: 500,
        fill: 'rgba(212, 165, 116, 0.85)',
        id: 'circle-3' 
      },
      { 
        radius: 250, // Outermost (largest radius)
        fontSize: 36, // Largest font
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif', // Simple sans-serif
        fontWeight: 400,
        fill: 'rgba(212, 165, 116, 0.8)',
        id: 'circle-4' 
      },
    ]

    circles.forEach((circle) => {
      // Create group positioned at center - this will be rotated (like Codrops structure)
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('transform', `translate(${centerX}, ${centerY})`)
      group.classList.add('circular-text-group')
      textGroupsRef.current.push(group)

      // Create circular path for this circle - relative to group origin (0,0)
      const pathId = circle.id
      const circlePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const d = `M ${-circle.radius},0 A ${circle.radius},${circle.radius} 0 1,1 ${circle.radius},0 A ${circle.radius},${circle.radius} 0 1,1 ${-circle.radius},0`
      circlePath.setAttribute('d', d)
      circlePath.setAttribute('id', pathId)
      circlePath.setAttribute('fill', 'none')
      circlePath.setAttribute('stroke', 'none')
      group.appendChild(circlePath)

      // Create text element with unique styling per circle
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      textElement.setAttribute('fill', circle.fill)
      textElement.setAttribute('font-family', circle.fontFamily)
      textElement.setAttribute('font-size', circle.fontSize.toString())
      textElement.setAttribute('font-weight', circle.fontWeight.toString())
      textElement.setAttribute('letter-spacing', '0.08em')
      textElement.setAttribute('text-transform', 'uppercase')

      // Calculate how many times to repeat sentence to fill the circle
      // Approximate character width is fontSize * 0.6, and we need to account for letter spacing
      const circumference = 2 * Math.PI * circle.radius
      const charWidth = circle.fontSize * 0.6
      const repeats = Math.ceil(circumference / (sentence.length * charWidth))
      const repeatedSentence = sentence.repeat(Math.max(1, repeats))

      const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
      textPath.setAttribute('href', `#${pathId}`)
      textPath.setAttribute('startOffset', '0%')
      textPath.textContent = repeatedSentence

      textElement.appendChild(textPath)
      group.appendChild(textElement)
      svg.appendChild(group)

      // Set transform origin to 0,0 (group's origin, which is at SVG center)
      gsap.set(group, { 
        transformOrigin: '0px 0px'
      })
    })

    // Initial animation - scale in and fade in (like Codrops)
    // Wait a frame to ensure elements are rendered
    requestAnimationFrame(() => {
      if (textGroupsRef.current.length > 0 && buttonRef.current) {
        gsap.set([textGroupsRef.current, buttonRef.current], { opacity: 0, scale: 0.3 })
        
        gsap.to([textGroupsRef.current, buttonRef.current], {
          duration: 2.5,
          ease: 'expo',
          scale: 1,
          opacity: 1,
          stagger: {
            amount: 0.5
          }
        })
      }
    })

    // Set SVG dimensions
    svg.setAttribute('width', '800')
    svg.setAttribute('height', '800')
    svg.setAttribute('viewBox', '0 0 800 800')
  }, [])

  // Handle animation on hover using GSAP (like Codrops example)
  useEffect(() => {
    if (hasEntered || textGroupsRef.current.length === 0) return

    const centerX = 400
    const centerY = 400

    if (isHovering) {
      // Kill any existing animations (like Codrops)
      rotationTweensRef.current.forEach(tween => tween?.kill())
      rotationTweensRef.current = []

      // Start rotation animation using SVG native transforms (like Codrops - rotate +=180 with power4 ease)
      // Rotate around the center point (0,0 relative to group, which is 400,400 in SVG)
      textGroupsRef.current.forEach((group, index) => {
        let currentRotation = 0
        
        const tween = gsap.to({ rotation: 0 }, {
          duration: 4,
          ease: 'power4',
          rotation: 180,
          delay: index * -0.3, // Stagger: -0.3
          onUpdate: function() {
            currentRotation = (this.targets()[0] as any).rotation
            // SVG transform: translate to center, then rotate around origin (0,0)
            // This keeps the group at center and rotates around that point
            group.setAttribute('transform', `translate(${centerX}, ${centerY}) rotate(${currentRotation})`)
          }
        })
        rotationTweensRef.current.push(tween)
      })
    } else {
      // Stop rotation on mouse leave
      rotationTweensRef.current.forEach(tween => tween?.kill())
      rotationTweensRef.current = []
    }

    return () => {
      rotationTweensRef.current.forEach(tween => tween?.kill())
      rotationTweensRef.current = []
    }
  }, [isHovering, hasEntered])

  const handleEnter = () => {
    if (hasEntered) return
    setHasEntered(true)

    // Kill hover animations
    rotationTweensRef.current.forEach(tween => tween?.kill())
    rotationTweensRef.current = []

    const totalCircles = textGroupsRef.current.length

    // Create tunnel zoom animation (like Codrops)
    const timeline = gsap.timeline({
      onComplete: () => {
        // Call onEnter after animation completes
        onEnter()
      }
    })

    // Animate button
    if (buttonRef.current) {
      timeline.to(buttonRef.current, {
        duration: 1.5,
        ease: 'expo.inOut',
        scale: 0.7,
        opacity: 0
      }, 0)
    }

    // Animate groups - tunnel zoom effect (like Codrops)
    // Use SVG native transforms to scale from center properly
    const centerX = 400
    const centerY = 400
    
    // Clear any rotation transforms first
    textGroupsRef.current.forEach((group) => {
      // Reset to just translate (no rotation)
      group.setAttribute('transform', `translate(${centerX}, ${centerY})`)
    })
    
    // Exact Codrops formula: scale: i => 1.5+(this.circleTextTotal-i)*.3
    textGroupsRef.current.forEach((group, index) => {
      const targetScale = 1.5 + (totalCircles - index) * 0.3 // Exact Codrops formula
      
      timeline.to({ scale: 1, opacity: 1 }, {
        duration: 1.5,
        ease: 'expo.inOut',
        scale: targetScale,
        opacity: 0,
        delay: index * 0.05, // Stagger: 0.2 total / 4 circles = 0.05 per circle
        onUpdate: function() {
          const scale = (this.targets()[0] as any).scale
          const opacity = (this.targets()[0] as any).opacity
          // SVG transform: translate to center, then scale around origin (0,0)
          // This scales from the center point
          group.setAttribute('transform', `translate(${centerX}, ${centerY}) scale(${scale})`)
          group.setAttribute('opacity', opacity.toString())
        }
      }, 0)
    })
  }

  return (
    <div ref={containerRef} className="circular-landing-page">
      <svg ref={svgRef} className="circular-landing-svg" />
      <button 
        ref={buttonRef}
        className="circular-enter-button"
        onClick={handleEnter}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        Enter
      </button>
    </div>
  )
}

