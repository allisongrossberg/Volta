import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './BirdFlockReveal.css'

// Fallback image path (served from public folder)
const FALLBACK_IMAGE_PATH = '/corey-oconnell-RW7nLtLRHro-unsplash.jpg'

interface ExplodingTextToBirdsProps {
  hypothesis: string
  illustrationUrl: string | null
  literaryText?: string // Literary text to display below image
  onRevealComplete?: () => void
  onOutputReady?: () => void // Called when final content (image + poem) is shown
  onParticlesFormed?: () => void // Called when particles are fully formed (70%+ birds at targets)
  skipAnimation?: boolean // If true, skip bird animation and show particles immediately
  skipExplosion?: boolean // If true, skip the text explosion phase (already happened on InputPage)
  onFlightBegins?: () => void // Called when birds begin flocking (hide input UI)
}

interface Bird {
  position: THREE.Vector3
  velocity: THREE.Vector3
  mesh: THREE.Mesh
  phase: number
  animationPhase: 'forming' | 'flocking' | 'revealing'
  exitTarget?: THREE.Vector3
  exitUV?: { u: number, v: number } // UV coordinates on image/text plane for reveal
  exitTargetType?: 'image' | 'text' | 'off' // Type of target (image, text, or off-screen)
  faceIndex?: number // Index of face/fragment this bird represents
  hasRevealed?: boolean // Track if this bird has contributed to reveal
  charIndex: number // Index of character (left to right) for sequential formation
  targetColor?: THREE.Color // Color to morph to (from image/text pixel)
  swarmPosition?: THREE.Vector3 // Intermediate waypoint for bezier morphing
  particleSourcePosition?: THREE.Vector3 // Source position when particle morph starts (bird's final position)
  particleMorphProgress?: number // Progress of particle morph (0 to 1)
  particleMorphStartTime?: number // When particle morph started
  particleVelocity?: THREE.Vector3 // Velocity for particle flocking behavior
  isButtonBird?: boolean // Mark if this is the button bird (leader)
}

function ExplodingTextToBirds({ hypothesis, illustrationUrl, literaryText, onRevealComplete, onOutputReady, onParticlesFormed, skipAnimation = false, skipExplosion = false, onFlightBegins }: ExplodingTextToBirdsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textContainerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const birdsRef = useRef<Bird[]>([])
  const animationFrameRef = useRef<number | null>(null)
  // Removed showText state - text container is always visible for explosion animation
  const [showFinalContent, setShowFinalContent] = useState(false) // Show final content
  const [shouldExitBirds, setShouldExitBirds] = useState(false) // Trigger bird exit
  const mouseWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
  const animationStartTimeRef = useRef<number>(0)
  const flockingStartTimeRef = useRef<number>(0) // Track when flocking started
  const imageParticleSystemRef = useRef<THREE.Points | null>(null) // Particle system for image
  const imageParticlePositionsRef = useRef<THREE.Vector3[]>([]) // Original positions for particles
  const imageParticleColorsRef = useRef<THREE.Color[]>([]) // Colors for each particle
  const imageParticleGeometryRef = useRef<THREE.BufferGeometry | null>(null) // Geometry for image particles
  const exitTriggeredRef = useRef<boolean>(false) // Track if exit has been triggered
  const shouldExitBirdsRef = useRef<boolean>(false) // Ref version of shouldExitBirds for immediate access
  const mousePositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0)) // Mouse position in world space
  const mouseRadiusRef = useRef<number>(50) // Radius of mouse influence (matching interactive-particles style)
  const outputReadyTriggeredRef = useRef<boolean>(false) // Track if onOutputReady has been called
  const particlesFormedTriggeredRef = useRef<boolean>(false) // Track if onParticlesFormed has been called
  const allBirdsRevealingStartTimeRef = useRef<number>(0) // Track when all birds first entered revealing phase
  const firstRevealingBirdTimeRef = useRef<number>(0) // Track when first bird enters revealing phase
  const revealCompleteTriggeredRef = useRef<boolean>(false) // Track if onRevealComplete has been called
  const touchCanvasRef = useRef<HTMLCanvasElement | null>(null) // Off-screen canvas for cursor trail (Codrops approach)
  const touchTextureRef = useRef<THREE.Texture | null>(null) // Texture from touch canvas
  const touchContextRef = useRef<CanvasRenderingContext2D | null>(null) // Context for touch canvas
  const particleBoundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null) // Cached bounds for cursor mapping
  const lastMouseScreenPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 }) // Last mouse screen position for smooth trail
  const touchCanvasRadiusRef = useRef<number>(30) // Radius for cursor circle on touch canvas
  const flightHasBegunRef = useRef<boolean>(false) // Track if we've called onFlightBegins
  const explosionStartedRef = useRef<boolean>(false) // Prevent double explosion in React Strict Mode
  const flockDelaySetRef = useRef<boolean>(false) // Track if flock delay has been set
  const buttonBirdEnteredRef = useRef<boolean>(false) // Track if button bird has entered the viewport
  const flockCanEnterRef = useRef<boolean>(false) // Track if flock can enter (replaces sessionStorage)

  useEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9)
    console.log(`🎬 ExplodingTextToBirds mounted [${componentId}]`, skipAnimation ? '(skipping animation)' : '', 'hypothesis:', hypothesis.substring(0, 30))
    
    // Prevent double execution in React Strict Mode
    if (explosionStartedRef.current) {
      console.log(`⚠️ Explosion already started [${componentId}], skipping duplicate mount`)
      return
    }
    explosionStartedRef.current = true
    console.log(`✅ Starting explosion [${componentId}]`)
    
    // If skipAnimation is true, immediately create particle system and skip all bird animation
    if (skipAnimation) {
      console.log('⏩ Skipping animation - creating particle system directly')
      // Initialize Three.js scene without birds
      initThreeJS([])
      // Immediately create particle system (use a reasonable default bird count for particle system)
      setTimeout(() => {
        if (sceneRef.current) {
          // Use a default bird count - particles will be created regardless
          loadIllustration(sceneRef.current, 250)
          if (onOutputReady) {
            onOutputReady()
          }
          if (onParticlesFormed) {
            onParticlesFormed()
          }
        }
      }, 100)
      return
    }
    
    // Step 1: Explode the text (skip if explosion already happened on InputPage)
    if (!skipExplosion) {
      // Get input position for text placement (not needed anymore, using textarea directly)

      // Position text container - try textarea first, fallback to center of screen
      // Look for both InputPage and LoadingPage overlay textareas
      const textarea = document.querySelector('.hypothesis-input, .hypothesis-input-overlay') as HTMLTextAreaElement
      
      // Hide the textarea content to prevent duplication
      if (textarea) {
        textarea.style.color = 'transparent'
        textarea.style.caretColor = 'transparent'
      }
      
      if (textContainerRef.current) {
        const textContainer = textContainerRef.current
        
        if (textarea) {
          // Position exactly over textarea (InputPage or LoadingPage overlay)
          const textareaRect = textarea.getBoundingClientRect()
          textContainer.style.position = 'fixed'
          textContainer.style.top = `${textareaRect.top}px`
          textContainer.style.left = `${textareaRect.left}px`
          textContainer.style.width = `${textareaRect.width}px`
          textContainer.style.textAlign = 'left' // Match textarea alignment
          console.log(`📍 Text container positioned at: top=${textareaRect.top}, left=${textareaRect.left}, width=${textareaRect.width}`)
        } else {
          // Fallback: center on screen (shouldn't happen)
          textContainer.style.position = 'fixed'
          textContainer.style.top = '50%'
          textContainer.style.left = '50%'
          textContainer.style.transform = 'translate(-50%, -50%)'
          textContainer.style.width = '80vw'
          textContainer.style.maxWidth = '900px'
          textContainer.style.textAlign = 'center'
          console.log(`📍 Text container positioned at center (no textarea found)`)
        }
        
        // Make text container visible
        textContainer.style.visibility = 'visible'
        textContainer.style.opacity = '1'
        textContainer.style.zIndex = '99' // BELOW birds (which are at z-index 100) so birds appear on top
      }
      // Start IMMEDIATELY - no delay!
      explodeText()
    } else {
      console.log('⏭️ Skipping explosion (already happened on InputPage) - starting bird animation directly')
      
      // Hide any textarea that might be visible
      const textarea = document.querySelector('.hypothesis-input, .hypothesis-input-overlay') as HTMLTextAreaElement
      if (textarea) {
        textarea.style.opacity = '0'
        textarea.style.visibility = 'hidden'
        textarea.style.pointerEvents = 'none'
      }
      
      // Button bird flew offscreen and is coming back with a flock
      console.log('🐦 Button bird returning with flock - creating birds entering from offscreen')
      
      // Create birds that enter from offscreen (right side) as a flock
      const totalBirds = Math.min(hypothesis.length * 2, 200)
      const charPositions: Array<{ char: string, x: number, y: number, isButtonBird?: boolean }> = []
      
      // Create positions for birds entering from offscreen (right side)
      // They'll start offscreen and fly in together
      // Account for sidebar (201px) when calculating offscreen position
      const sidebarWidth = 201
      const viewportWidth = window.innerWidth - sidebarWidth
      const viewportHeight = window.innerHeight
      
      // Position button bird significantly ahead of the flock
      // Button bird enters first from offscreen, then flock follows after a delay
      // Button bird should be closer to viewport so it enters well before the flock
      const viewportRightEdge = sidebarWidth + viewportWidth
      const buttonBirdScreenX = viewportWidth + 100 // Close to viewport - enters first
      const buttonBirdScreenY = viewportHeight / 2 // Center vertically
      const buttonBirdAbsoluteX = buttonBirdScreenX + sidebarWidth
      
      console.log('🐦 Button bird position:', { 
        buttonBirdScreenX, 
        buttonBirdScreenY, 
        buttonBirdAbsoluteX,
        viewportWidth, 
        viewportHeight,
        viewportRightEdge
      })
      
      // Create the button bird (leader) first - positioned ahead of the flock
      charPositions.push({
        char: hypothesis[0] || 'A',
        x: buttonBirdAbsoluteX, // Absolute screen position
        y: buttonBirdScreenY,
        isButtonBird: true // Mark as button bird
      })
      
      console.log('🐦 Button bird entering - flock will wait')
        
        // Create the rest of the flock behind the button bird
        // Position them further to the right (larger x) so button bird enters first with clear separation
        // IMPORTANT: All birds must start OFFSCREEN (beyond viewport + sidebar)
        // Button bird is closer to viewport, flock is further right (will enter later)
        for (let i = 1; i < totalBirds; i++) {
          const charIndex = i % hypothesis.length
          // Position flock birds further to the right (800-1000px further) so button bird enters first
          // Stagger them slightly so they don't all appear at once
          const staggerOffset = (i % 10) * 20 // Stagger every 10 birds by 20px
          // Flock should be 800-1000px further right than button bird (will enter later)
          const flockAbsoluteX = buttonBirdAbsoluteX + 800 + staggerOffset + (Math.random() - 0.5) * 50
          // Ensure flock starts offscreen: must be beyond viewport right edge
          const absoluteFlockX = Math.max(flockAbsoluteX, viewportRightEdge + 200) // At least 200px offscreen
          const startY = buttonBirdScreenY + (Math.random() - 0.5) * 300 // Vertical spread around button bird
          charPositions.push({
            char: hypothesis[charIndex] || 'A',
            x: absoluteFlockX, // Absolute screen position
            y: startY
          })
        }
        
        const firstFlockX = charPositions.length > 1 ? charPositions[1].x : 0
        console.log(`🐦 Created ${charPositions.length} bird positions - button bird at x=${buttonBirdScreenX + sidebarWidth}, first flock bird at x=${firstFlockX}, viewport right edge=${sidebarWidth + viewportWidth}`)
        
        // Initialize with all birds starting offscreen
        initThreeJS(charPositions)
        
        // Birds will fly in from offscreen as part of the normal animation
        // The animation system will handle them entering and flocking
    }

    // Handle window resize to maintain proper aspect ratio
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return
      
      const container = containerRef.current
      const width = container.clientWidth
      const height = container.clientHeight
      
      // Update camera aspect ratio
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      
      // Update renderer size
      rendererRef.current.setSize(width, height)
      
      console.log(`📐 Resized: ${width}x${height}, aspect: ${(width / height).toFixed(2)}`)
    }
    
    // Add resize listener
    window.addEventListener('resize', handleResize)
    
    // Initial resize to ensure correct sizing
    handleResize()

    return () => {
      console.log('🧹 ExplodingTextToBirds cleanup')
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (rendererRef.current && containerRef.current?.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
      // Don't reset explosionStartedRef here - we want to prevent React Strict Mode double mount
      // If component truly unmounts and remounts (navigation), a new instance will be created
    }
  }, [])

  // Note: onOutputReady is now called when birds start transitioning to revealing phase
  // (when bird-to-particle animation begins), not when showFinalContent is set

  // Particle system is created in createBirdsFromChars using fallback image only

  // Watch for literaryText changes to create text geometry
  // NOTE: Text geometry creation is disabled - using particles only for now
  useEffect(() => {
    if (literaryText && sceneRef.current) {
      console.log('📝 Literary text received (text particles not yet implemented):', literaryText.substring(0, 50))
      // createTextGeometry(literaryText, sceneRef.current) // Disabled - using particles only
    }
  }, [literaryText])

  function explodeText() {
    console.log('💥 explodeText called, hypothesis:', hypothesis)
    
    // Ensure textContainer is available - wait a frame if needed
    if (!textContainerRef.current) {
      // Try waiting one frame for React to render
      requestAnimationFrame(() => {
        if (textContainerRef.current) {
          explodeText()
        } else {
          console.warn('⚠️ textContainerRef.current is still null after wait')
        }
      })
      return
    }
    
    const textElement = textContainerRef.current.querySelector('h2')
    if (!textElement) {
      console.warn('⚠️ h2 element not found in textContainer')
      return
    }

    console.log('✅ Starting text explosion animation')
    // Split text into words, each word will become a bird
    const words = hypothesis.split(' ').filter(w => w.trim().length > 0)
    console.log(`📝 Found ${words.length} words to explode`)
    const wordElements: { element: HTMLElement, chars: HTMLElement[], word: string }[] = []
    
    textElement.innerHTML = ''
    
    // Create word containers - ensure they layout inline
    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement('span')
      wordSpan.style.display = 'inline-block'
      wordSpan.style.marginRight = '0.5em'
      wordSpan.style.position = 'relative'
      wordSpan.style.whiteSpace = 'nowrap'
      wordSpan.setAttribute('data-word-index', wordIndex.toString())
      
      const chars: HTMLElement[] = []
      
      // Split word into characters
      word.split('').forEach((char, i) => {
        const charSpan = document.createElement('span')
        charSpan.textContent = char
        charSpan.style.display = 'inline-block'
        charSpan.style.position = 'relative'
        charSpan.style.transition = 'all 1s cubic-bezier(0.19, 1, 0.22, 1)'
        charSpan.setAttribute('data-word', wordIndex.toString())
        charSpan.setAttribute('data-char', i.toString())
        wordSpan.appendChild(charSpan)
        chars.push(charSpan)
      })
      
      textElement.appendChild(wordSpan)
      
      // Add space after word (except last word)
      if (wordIndex < words.length - 1) {
        const space = document.createTextNode(' ')
        textElement.appendChild(space)
      }
      
      wordElements.push({ element: wordSpan, chars, word })
    })
    
    console.log(`📝 Created ${wordElements.length} word elements in DOM`)

    // Capture CHARACTER positions AFTER DOM layout (each character becomes a bird)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Collect all character elements with their positions
        const charData: { element: HTMLElement, x: number, y: number, char: string }[] = []
        
        wordElements.forEach((wordData) => {
          wordData.chars.forEach((charEl) => {
            const rect = charEl.getBoundingClientRect()
            charData.push({
              element: charEl,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              char: charEl.textContent || ''
            })
          })
        })
        
        // Sort characters by X position (left to right) for sequential animation
        charData.sort((a, b) => a.x - b.x)
        
        // Also collect positions for 3D birds (sorted)
        const charPositions = charData.map(cd => ({ x: cd.x, y: cd.y, char: cd.char }))
        
        console.log(`📍 Captured positions for ${charPositions.length} characters (sorted left to right)`)
        charPositions.forEach((cp, i) => {
          console.log(`  Char ${i} "${cp.char}": x=${cp.x.toFixed(0)}, y=${cp.y.toFixed(0)}`)
        })
        
        // Start 3D scene IMMEDIATELY with birds - they will appear as text fades
        console.log('🎬 Starting 3D scene with birds')
        initThreeJS(charPositions)
        
        // Animate text to morph into birds - synchronized transformation
        charData.forEach((charInfo, index) => {
          // Sequential delay - left to right, matching bird formation
          const delayPerChar = 30 // 30ms between each character
          const totalDelay = index * delayPerChar
          
          setTimeout(() => {
            const char = charInfo.element
            
            // Phase 1: Text starts morphing (0.5s) - becomes bird-like
            char.style.transition = 'all 0.5s ease-out'
            char.style.opacity = '0.7' // Fade but stay visible during morph
            char.style.transform = 'translateY(-15px) scaleX(0.3) scaleY(1.2)' // Elongate like bird
            
            // Phase 2: Complete transformation (1.0s later) - fade as birds take over
            setTimeout(() => {
              char.style.transition = 'all 1.0s ease-out'
              char.style.opacity = '0'
              char.style.transform = 'translateY(-40px) scale(0.1)' // Shrink and rise
            }, 500)
          }, totalDelay)
        })
      })
    })
  }

  function initThreeJS(charPositions: { x: number, y: number, char: string, isButtonBird?: boolean }[]) {
    if (!containerRef.current) {
      console.error('❌ containerRef.current is NULL - cannot initialize Three.js!')
      console.log('Retrying in 100ms...')
      setTimeout(() => initThreeJS(charPositions), 100)
      return
    }

    const container = containerRef.current
    console.log('✅ Container found, initializing Three.js scene')
    // Get dimensions from container (which accounts for sidebar)
    const width = container.clientWidth
    const height = container.clientHeight

    console.log(`📐 Container dimensions: ${width}x${height} (full viewport minus sidebar)`)

    // Scene - make it visible for debugging
    const scene = new THREE.Scene()
    // Use Color constructor with CSS color string to ensure exact match
    const sceneBgColor = new THREE.Color('#ffffff')
    // Use transparent background so form shows through initially
    scene.background = null
    scene.fog = new THREE.Fog(sceneBgColor.clone(), 100, 1000) // Match background color
    sceneRef.current = scene
    
    console.log('🎨 Scene created with background')

    // Camera - positioned to see the birds and particles centered
    // FOV of 50 matches the particle system calculations
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 3000)
    camera.position.set(0, 0, 200) // Distance matches particle system calculations
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer - enable alpha for transparency
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    // Set clear color - transparent so form shows through
    const bgColor = new THREE.Color('#ffffff')
    renderer.setClearColor(bgColor, 0.0) // Fully transparent
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // Position canvas to fill container exactly
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.zIndex = '100'
    renderer.domElement.style.pointerEvents = 'auto'
    // Canvas background should be transparent to see through to page
    renderer.domElement.style.backgroundColor = 'transparent'
    renderer.domElement.style.margin = '0'
    renderer.domElement.style.padding = '0'
    renderer.domElement.style.display = 'block' // Ensure no inline spacing
    renderer.domElement.style.verticalAlign = 'top' // Remove any baseline spacing
    renderer.domElement.style.outline = 'none' // Remove any outline
    renderer.domElement.style.border = 'none' // Remove any border
    // Start visible immediately - no flash prevention needed
    renderer.domElement.style.opacity = '1'
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    console.log('🖼️ Canvas appended to container:', {
      containerClass: container.className,
      containerPosition: container.style.position,
      containerZIndex: container.style.zIndex,
      canvasZIndex: renderer.domElement.style.zIndex,
      canvasOpacity: renderer.domElement.style.opacity,
      skipExplosion: skipExplosion
    })
    
    // Immediately render a blank frame with correct background color to prevent flash
    // Use requestAnimationFrame to ensure this happens after DOM is ready
    requestAnimationFrame(() => {
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.clear()
        rendererRef.current.render(sceneRef.current, cameraRef.current)
        // Show canvas after first render with correct background
        rendererRef.current.domElement.style.opacity = '1'
        rendererRef.current.domElement.style.transition = 'opacity 0.1s ease-in'
        console.log('🎨 Canvas made visible, scene children:', sceneRef.current.children.length)
        console.log('🎨 Canvas computed style:', {
          opacity: window.getComputedStyle(rendererRef.current.domElement).opacity,
          zIndex: window.getComputedStyle(rendererRef.current.domElement).zIndex,
          display: window.getComputedStyle(rendererRef.current.domElement).display,
          visibility: window.getComputedStyle(rendererRef.current.domElement).visibility
        })
      }
    })
    
    console.log('🖼️ Renderer created and added to DOM')

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Canvas-based reveal removed - using particles now

    // Load illustration (will be called after birds are created)
    // We'll create the particle system once we know how many birds we have

    // Create birds from character positions - one bird per character!
    createBirdsFromChars(charPositions, scene, camera)

    // Mouse tracking for bird avoidance and particle interaction (Bruno Imbrizi approach)
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseScreenPosRef.current = { x: e.clientX, y: e.clientY }
      
      // Get container bounds for precise coordinate mapping
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      
      // Convert mouse coordinates to container-relative coordinates
      const containerX = e.clientX - containerRect.left
      const containerY = e.clientY - containerRect.top
      
      // Ensure coordinates are within container bounds
      if (containerX < 0 || containerX > containerRect.width || 
          containerY < 0 || containerY > containerRect.height) return
      
      // Convert to normalized device coordinates (-1 to 1)
      const mouse = new THREE.Vector2(
        (containerX / containerRect.width) * 2 - 1,
        -(containerY / containerRect.height) * 2 + 1
      )
      
      // Convert to world coordinates
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      const worldPos = camera.position.clone().add(dir.multiplyScalar(distance))
      mouseWorldPosRef.current.copy(worldPos)
      mousePositionRef.current.copy(worldPos) // Also update for particle system
      
      // Draw cursor trail on touch canvas (Codrops approach) - only if particles are active
      if (touchContextRef.current && touchCanvasRef.current && particleBoundsRef.current) {
        const ctx = touchContextRef.current
        const canvas = touchCanvasRef.current
        const bounds = particleBoundsRef.current
        
        const boundsSizeX = bounds.maxX - bounds.minX || 1
        const boundsSizeY = bounds.maxY - bounds.minY || 1
        
        // Map world position to canvas coordinates using cached bounds (Bruno Imbrizi approach)
        const canvasX = ((worldPos.x - bounds.minX) / boundsSizeX) * canvas.width
        const canvasY = canvas.height - ((worldPos.y - bounds.minY) / boundsSizeY) * canvas.height // Flip Y for canvas
        
        // Clamp to canvas bounds
        const clampedX = Math.max(0, Math.min(canvas.width, canvasX))
        const clampedY = Math.max(0, Math.min(canvas.height, canvasY))
        
        // Draw a bright circle at cursor position to create attraction
        // Using a radial gradient that fades from bright white to gray
        const gradient = ctx.createRadialGradient(
          clampedX, clampedY, 0,
          clampedX, clampedY, touchCanvasRadiusRef.current
        )
        gradient.addColorStop(0, '#ffffff') // Center bright white
        gradient.addColorStop(0.5, '#cccccc') // Mid gradient
        gradient.addColorStop(1, '#666666')  // Edges darker
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(clampedX, clampedY, touchCanvasRadiusRef.current, 0, Math.PI * 2)
        ctx.fill()
        
        // Add a brighter inner circle for more pronounced effect
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(clampedX, clampedY, touchCanvasRadiusRef.current * 0.4, 0, Math.PI * 2)
        ctx.fill()
        
        // Update texture
        if (touchTextureRef.current) {
          touchTextureRef.current.needsUpdate = true
        }
      }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Start animation
    animationStartTimeRef.current = Date.now()
    startAnimation()
  }

  function createBirdsFromChars(
    charPositions: { x: number, y: number, char: string, isButtonBird?: boolean }[], 
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    const birds: Bird[] = []
    
    // Bird geometry - Boid bird shape with animated wings
    // Based on classic Boid implementation with wing flapping
    // Matches the Boid example: vertices 4 and 5 are wing tips that flap together
    const birdGeometry = new THREE.BufferGeometry()
    // Boid bird shape: arrow/triangle pointing forward with symmetric wings
    // Classic Boid shape: nose at front, body triangle, wings extend outward
    const vertices = new Float32Array([
      0, 0, 0,      // 0: nose (front point)
      -1, -1, 0,    // 1: bottom left back
      1, -1, 0,     // 2: bottom right back
      -1, 1, 0,     // 3: top left back
      -2, 0, 0,     // 4: left wing tip (will animate - Y coordinate)
      2, 0, 0,      // 5: right wing tip (will animate - Y coordinate)
    ])
    birdGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    
    // Create faces for the bird shape (triangular mesh)
    const indices = new Uint16Array([
      0, 1, 2,  // Nose to bottom back
      0, 1, 4,  // Nose to left wing
      0, 2, 5,  // Nose to right wing
      0, 3, 4,  // Nose to top left wing
      0, 3, 5,  // Nose to top right wing
      1, 3, 4,  // Left side
      2, 3, 5,  // Right side
    ])
    birdGeometry.setIndex(new THREE.BufferAttribute(indices, 1))
    birdGeometry.computeVertexNormals()

    // Fewer birds per character for cleaner, more visible transformation
    // Each letter becomes 2-3 birds instead of many
    const MAX_TOTAL_BIRDS = 200 // Reduced from 250
    const MAX_BIRDS_PER_CHAR = 3 // Much fewer per char (was 20)
    const MIN_BIRDS_PER_CHAR = 2 // At least 2 birds per character
    
    // Calculate birds per character to stay under the max total
    // For shorter text: more birds per char (up to MAX_BIRDS_PER_CHAR)
    // For longer text: fewer birds per char (down to MIN_BIRDS_PER_CHAR)
    let birdsPerChar = Math.floor(MAX_TOTAL_BIRDS / charPositions.length)
    birdsPerChar = Math.max(MIN_BIRDS_PER_CHAR, Math.min(birdsPerChar, MAX_BIRDS_PER_CHAR))
    
    const totalBirds = birdsPerChar * charPositions.length
    console.log(`🐦 Scaling birds: ${charPositions.length} chars → ${birdsPerChar} birds/char = ${totalBirds} total birds`)
    
    // Get container dimensions for world space calculations (sidebar: 200px + 1px border)
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth - 201
    const containerHeight = containerRef.current?.clientHeight || window.innerHeight
    
    charPositions.forEach((charPos, charIndex) => {
      // Convert screen coordinates to 3D world coordinates
      const screenCenterX = containerWidth / 2 + 201 // Add sidebar offset for absolute screen coords (200px + 1px border)
      const screenCenterY = containerHeight / 2
      
      // Convert to world space with proper scaling
      const fov = camera.fov * (Math.PI / 180)
      const distance = 200
      const worldHeight = 2 * Math.tan(fov / 2) * distance
      const worldWidth = worldHeight * (containerWidth / containerHeight)
      
      // Base position for this character
      const normalizedX = (charPos.x - screenCenterX) / (containerWidth / 2)
      const normalizedY = -(charPos.y - screenCenterY) / (containerHeight / 2)
      const baseWorldX = normalizedX * (worldWidth / 2)
      const baseWorldY = normalizedY * (worldHeight / 2)
      
      // For button bird, create only ONE bird (not multiple per character)
      const isButtonBird = charPos.isButtonBird === true
      const birdsToCreate = isButtonBird ? 1 : birdsPerChar
      
      // Create multiple birds per character (or just one for button bird)
      for (let birdIndex = 0; birdIndex < birdsToCreate; birdIndex++) {
        // Spread birds out more so they're not clustered
        // Button bird should be at the exact position (no offset)
        const offsetX = isButtonBird ? 0 : (Math.random() - 0.5) * 15 // No offset for button bird
        const offsetY = isButtonBird ? 0 : (Math.random() - 0.5) * 15 // No offset for button bird
        const offsetZ = isButtonBird ? 0 : (Math.random() - 0.5) * 20 // No offset for button bird
        
        const worldX = baseWorldX + offsetX
        const worldY = baseWorldY + offsetY
        const worldZ = offsetZ
        
        const worldPos = new THREE.Vector3(worldX, worldY, worldZ)

        // Create bird mesh - start at low opacity, will become visible as text fades
        // BUT: If bird is flying in from offscreen, make it fully visible immediately
        // Check if bird is offscreen: account for sidebar (201px) - birds should be beyond viewport
        const sidebarWidth = 201
        const viewportRightEdge = sidebarWidth + (window.innerWidth - sidebarWidth)
        const isOffscreen = charPos.x > viewportRightEdge - 100 || (isButtonBird && charPos.x > viewportRightEdge - 200)
        // isButtonBird is already defined above in the loop scope
        // Button bird is fully visible, brightly colored, and larger to stand out as leader
        const initialOpacity = isOffscreen ? 1.0 : 0.3 // Fully visible if flying in
        
        // Button bird gets the same color as the button (#758A93)
        // Other birds get different shades of black and grey for dimension
        let birdColor: number
        if (isButtonBird) {
          birdColor = 0x758A93 // Slate blue-gray to match button color
        } else {
          // Different shades of black and grey for dimension
          const shades = [
            0x1a1a1a, // Very dark grey (almost black)
            0x2d2d2d, // Dark grey
            0x404040, // Medium dark grey
            0x333333, // Charcoal grey
            0x262626, // Dark charcoal
            0x0d0d0d, // Almost black
          ]
          // Use bird index to vary colors for dimension
          birdColor = shades[birds.length % shades.length]
        }
        const birdMaterial = new THREE.MeshPhongMaterial({
          color: birdColor,
          shininess: 20,
          transparent: true,
          opacity: initialOpacity, // Start visible if flying in from offscreen
          side: THREE.DoubleSide
        })
        
        const birdMesh = new THREE.Mesh(birdGeometry.clone(), birdMaterial)
        birdMesh.position.copy(worldPos)
        // Increased bird size - button bird slightly larger
        const initialScale = isButtonBird ? 1.2 : (isOffscreen ? 0.8 : 0.6)
        birdMesh.scale.set(initialScale, initialScale, initialScale)
        scene.add(birdMesh)
        
        // Debug: Log first few birds
        if (birds.length < 3) {
          console.log(`🐦 Bird ${birds.length} created at world position:`, worldPos.toArray(), 'screen pos:', { x: charPos.x, y: charPos.y }, 'opacity:', birdMaterial.opacity, 'scale:', initialScale, 'isButtonBird:', isButtonBird)
        }

        // Create position vector that we'll update
        const birdPosition = worldPos.clone()

        // Birds start in forming phase, will transition to flocking
        // If bird starts offscreen (skipExplosion mode), give it velocity to fly in
        // Button bird flies in faster and more directly to lead the flock
        // Flock birds start with zero velocity and will be delayed
        const buttonBirdEntering = skipExplosion // Use skipExplosion prop instead of session storage
        const initialVelocity = isOffscreen 
          ? (isButtonBird 
              ? new THREE.Vector3(-30, (Math.random() - 0.5) * 0.5, 0) // Much faster for leader to stay ahead
              : buttonBirdEntering 
                ? new THREE.Vector3(0, 0, 0) // Flock starts stationary, will be activated after delay
                : new THREE.Vector3(-15, (Math.random() - 0.5) * 5, 0)) // Normal speed if no button bird
          : new THREE.Vector3(0, 0, 0) // Start stationary
        
        birds.push({
          position: birdPosition,
          velocity: initialVelocity, // Start with velocity if offscreen
          mesh: birdMesh,
          phase: Math.random() * Math.PI * 2,
          animationPhase: 'forming', // Always start forming
          charIndex: charIndex, // Store character index for sequential formation
          isButtonBird: isButtonBird // Mark if this is the button bird
        })
      }
    })
    
    console.log(`🐦 Created ${birds.length} birds total in scene`)

    birdsRef.current = birds
    console.log(`✅ Created ${birds.length} birds (${birdsPerChar} per character) from ${charPositions.length} characters!`)
    
    // Create particle system for the bird-to-particle transition
    // This happens after birds have flocked for a while
    if (sceneRef.current && !imageParticleSystemRef.current) {
      console.log(`🖼️ Creating particle system for ${birds.length} birds (using fallback image)`)
      // Always use fallback image
      loadIllustration(sceneRef.current, birds.length)
      console.log(`✅ Particle system created: hasSystem=${!!imageParticleSystemRef.current}, positions=${imageParticlePositionsRef.current.length}`)
    } else {
      console.log(`⚠️ Particle system not created: hasScene=${!!sceneRef.current}, hasSystem=${!!imageParticleSystemRef.current}`)
    }
  }

  // sampleColorAtUV removed - not needed for particle system (particles have colors assigned directly)

  function loadIllustration(scene: THREE.Scene, birdCount: number) {
    // Create exactly as many particles as birds - one particle per bird
    // Use generated image if available, otherwise fallback to default image
    const targetPositions: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    
    // Use illustrationUrl if provided, otherwise use fallback
    const imageUrl = illustrationUrl || FALLBACK_IMAGE_PATH
    
    console.log(`🖼️ Loading image for particle system: ${imageUrl ? (illustrationUrl ? 'generated' : 'fallback') : 'none'}`)
    const img = new Image()
    // Set crossOrigin for all images to allow canvas pixel reading
    // Pollinations.AI should support CORS - if it doesn't, we'll fall back to circular pattern
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      console.log(`🖼️ Image loaded: ${img.width}x${img.height}, creating particle system...`)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('❌ Could not get canvas context')
        return
      }
      
      canvas.width = img.width
      canvas.height = img.height
      
      try {
        ctx.drawImage(img, 0, 0)
      } catch (error) {
        console.error('❌ Error drawing image to canvas:', error)
        // Fall back to circular pattern if we can't draw the image
        if (img.onerror) {
          img.onerror(new ErrorEvent('error'))
        }
        return
      }
      
      // Get image data - this will fail if canvas is tainted (CORS issue)
      let imageData: ImageData
      let pixels: Uint8ClampedArray
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        pixels = imageData.data
      } catch (error) {
        console.error('❌ CORS error: Cannot read canvas pixels (image is tainted). Falling back to circular pattern.', error)
        // Fall back to circular pattern if we can't read pixels
        if (img.onerror) {
          img.onerror(new ErrorEvent('error'))
        }
        return
      }
      
      // Sample pixels from the image (matching Codrops tutorial approach)
      const validPixels: { x: number, y: number, r: number, g: number, b: number }[] = []
      const threshold = 34 // Codrops uses hex #22 = decimal 34 for brightness threshold
      const whiteThreshold = 220 // Pixels with all RGB values above this are considered white/light background (lowered to be more strict)
      
      // First pass: collect pixels with sufficient brightness
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const a = pixels[idx + 3]
          
          // Only include pixels with sufficient opacity AND brightness
          // CRITICAL: Exclude near-white pixels (background) - all RGB channels must not be too high
          const isNearWhite = r > whiteThreshold && g > whiteThreshold && b > whiteThreshold
          if (a > 128 && r > threshold && !isNearWhite) {
            validPixels.push({ x, y, r, g, b })
          }
        }
      }
      
      // Create particles from image pixels (same strategy as main image)
      let sampleStep = 1
      
      if (validPixels.length > 50000) {
        sampleStep = Math.max(1, Math.floor(validPixels.length / 50000))
      } else if (validPixels.length > 20000) {
        sampleStep = Math.max(1, Math.floor(validPixels.length / 30000))
      }
      
      const sampledPixels: { x: number, y: number, r: number, g: number, b: number }[] = []
      
      if (sampleStep === 1) {
        sampledPixels.push(...validPixels)
      } else {
        for (let i = 0; i < validPixels.length; i += sampleStep) {
          sampledPixels.push(validPixels[i])
        }
      }
      
      console.log(`📊 Sampling ${sampledPixels.length} particles from ${validPixels.length} valid pixels (fallback image: ${canvas.width}x${canvas.height})`)
      
      // Convert pixel positions to 3D coordinates
      // Match the final output image size: max-width 80vw, max-height 75vh
      // Calculate world space dimensions to match screen display
      // Use actual container dimensions (accounts for sidebar: 200px + 1px border)
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth - 201
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight
      const imageAspect = canvas.width / canvas.height
      const fov = 50 * (Math.PI / 180) // Camera FOV in radians
      const distance = 200 // Camera distance
      const worldHeight = 2 * Math.tan(fov / 2) * distance
      const worldWidth = worldHeight * (containerWidth / containerHeight)
      
      // Scale to match final output: 80vw max width (of available width), 75vh max height
      const maxScreenWidth = containerWidth * 0.8
      const maxScreenHeight = containerHeight * 0.75
      const screenAspect = maxScreenWidth / maxScreenHeight
      
      // Calculate 3D dimensions that match the screen display
      let width3D, height3D
      if (imageAspect > screenAspect) {
        // Image is wider - constrain by width
        width3D = worldWidth * 0.8
        height3D = width3D / imageAspect
      } else {
        // Image is taller - constrain by height
        height3D = worldHeight * 0.75
        width3D = height3D * imageAspect
      }
      
      sampledPixels.forEach((pixel) => {
        // Clamp to ensure particles stay within image bounds
        const normalizedX = Math.max(0, Math.min(1, pixel.x / canvas.width))
        const normalizedY = Math.max(0, Math.min(1, pixel.y / canvas.height))
        const x = (normalizedX - 0.5) * width3D
        const y = (0.5 - normalizedY) * height3D
        const z = (Math.random() - 0.5) * 0.5 // Reduced Z variation to keep particles in plane
        
        targetPositions.push(new THREE.Vector3(x, y, z))
        
        const color = new THREE.Color()
        color.setRGB(pixel.r / 255, pixel.g / 255, pixel.b / 255)
        colors.push(color)
      })
      
      imageParticlePositionsRef.current = targetPositions
      imageParticleColorsRef.current = colors
      const particleCount = targetPositions.length
      
      // Calculate actual bounds for UV mapping
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      targetPositions.forEach(pos => {
        minX = Math.min(minX, pos.x)
        maxX = Math.max(maxX, pos.x)
        minY = Math.min(minY, pos.y)
        maxY = Math.max(maxY, pos.y)
      })
      
      console.log(`🔧 Creating particle system with fallback image: scene=${!!scene}, particleCount=${particleCount}, birdCount=${birdCount}`)
      try {
        createParticleSystem(scene, particleCount, targetPositions, colors)
        console.log(`✅ createParticleSystem completed (fallback image): hasSystem=${!!imageParticleSystemRef.current}`)
      } catch (error) {
        console.error('❌ Error creating particle system (fallback image):', error)
      }
    }
    
    img.onerror = () => {
      console.error(`❌ Failed to load image (${imageUrl}), using circular pattern`)
      // Ultimate fallback: circular pattern
      const targetParticleCount = birdCount * 4
      for (let i = 0; i < targetParticleCount; i++) {
        const t = i / targetParticleCount
        const angle = t * Math.PI * 2 * 2.0
        const distance = 15 + (20 * (0.5 + Math.sin(t * Math.PI * 4) * 0.3))
        targetPositions.push(new THREE.Vector3(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          (Math.random() - 0.5) * 3
        ))
        const hue = (t * 360) % 360
        const color = new THREE.Color()
        color.setHSL(hue / 360, 0.8, 0.5 + Math.random() * 0.2)
        colors.push(color)
      }
      imageParticlePositionsRef.current = targetPositions
      imageParticleColorsRef.current = colors
      const particleCount = targetPositions.length
      createParticleSystem(scene, particleCount, targetPositions, colors)
    }
    
    img.src = imageUrl
  }
  
  function createParticleSystem(
    scene: THREE.Scene, 
    particleCount: number, 
    _targetPositions: THREE.Vector3[], // Target positions are stored in imageParticlePositionsRef
    colors: THREE.Color[]
  ) {
    console.log(`🔧 createParticleSystem called: scene=${!!scene}, particleCount=${particleCount}, colors=${colors.length}`)
    
    if (!scene) {
      console.error('❌ Cannot create particle system: scene is null')
      return
    }
    
    if (particleCount === 0) {
      console.error('❌ Cannot create particle system: particleCount is 0')
      return
    }
    
    // CRITICAL: Remove existing particle system if one exists to prevent duplicates
    if (imageParticleSystemRef.current) {
      console.log('🗑️ Removing existing particle system before creating new one')
      scene.remove(imageParticleSystemRef.current)
      // Dispose of geometry and material to free memory
      if (imageParticleGeometryRef.current) {
        imageParticleGeometryRef.current.dispose()
      }
      const material = imageParticleSystemRef.current.material
      if (material) {
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose())
        } else {
          material.dispose()
        }
      }
      imageParticleSystemRef.current = null
      imageParticleGeometryRef.current = null
    }
    
    // Get target positions from ref (they were stored when image was loaded)
    const targetPositions = imageParticlePositionsRef.current
    
    // Create particle geometry with all particles
    // CRITICAL: Initialize particles at origin (not target positions) to prevent premature image appearance
    // Particles will be positioned by birds during morph, then animated to target positions
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(colors.length * 3)
    const opacities = new Float32Array(particleCount) // Per-particle opacity
    
    // Initialize all particles at origin with 0 opacity
    // CRITICAL: Particles start invisible at origin, will be positioned at bird locations during morph
    // Then they will gradually move to target positions to form the image
    for (let i = 0; i < particleCount; i++) {
      // Start all particles at origin - they will be positioned by birds during morph
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      opacities[i] = 0.0 // Start invisible - will fade in as birds morph
    }
    
    // Use actual colors from the image (matching Codrops tutorial - particles show image colors)
    colors.forEach((color, i) => {
      particleColors[i * 3] = color.r
      particleColors[i * 3 + 1] = color.g
      particleColors[i * 3 + 2] = color.b
    })
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1))
    
    // Calculate brightness values for variable particle size (matching Codrops tutorial exactly)
    // Use luminosity method from original image colors: 0.21 R + 0.71 G + 0.07 B
    // This brightness is used for particle SIZE, not color
    const brightnessValues = new Float32Array(particleCount)
    colors.forEach((color, i) => {
      // Calculate brightness using luminosity method (matching Codrops tutorial: 0.21 R + 0.71 G + 0.07 B)
      // Note: Codrops uses 0.71 for green, not 0.72
      brightnessValues[i] = color.r * 0.21 + color.g * 0.71 + color.b * 0.07
    })
    
    // Add brightness as attribute for size calculation
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnessValues, 1))
    imageParticleGeometryRef.current = geometry
    
    // Create off-screen canvas for cursor trail (Codrops approach)
    const touchCanvas = document.createElement('canvas')
    touchCanvas.width = 512
    touchCanvas.height = 512
    const touchContext = touchCanvas.getContext('2d')
    if (!touchContext) {
      console.error('❌ Could not get 2D context for touch canvas')
    } else {
      touchContext.fillStyle = '#000000'
      touchContext.fillRect(0, 0, touchCanvas.width, touchCanvas.height)
      touchCanvasRef.current = touchCanvas
      touchContextRef.current = touchContext
    }
    
    // Create texture from touch canvas
    const touchTexture = new THREE.CanvasTexture(touchCanvas)
    touchTexture.minFilter = THREE.LinearFilter
    touchTexture.magFilter = THREE.LinearFilter
    touchTextureRef.current = touchTexture
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uMousePos: { value: new THREE.Vector3(0, 0, 0) },
        uMouseRadius: { value: mouseRadiusRef.current },
        uSize: { value: 5.0 }, // Base size multiplier (reduced for smaller particles)
        uTouch: { value: touchTexture }, // Cursor trail texture (Codrops approach)
        uBoundsMin: { value: new THREE.Vector2(-50, -50) }, // Will be updated after calculating bounds
        uBoundsMax: { value: new THREE.Vector2(50, 50) } // Will be updated after calculating bounds
      },
        vertexShader: `
          attribute float opacity;
          attribute float brightness;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform vec3 uMousePos;
          uniform float uMouseRadius;
          uniform float uSize;
          uniform sampler2D uTouch;
          uniform vec2 uBoundsMin;
          uniform vec2 uBoundsMax;
          
          void main() {
            // Three.js automatically provides 'color' attribute when vertexColors: true
            vColor = color;
            vOpacity = opacity;
          
            vec3 pos = position;
            
            // Mouse interaction using texture-based approach (Codrops method)
            // Map particle position to texture coordinates (0-1 range)
            // Assuming particle positions are in world space, normalize to texture space
            // We need to map from world coordinates to texture UV coordinates
            // For simplicity, use a normalized mapping based on particle bounds
            // The texture represents the cursor trail over time
            
            // Convert world position to texture UV coordinates using actual bounds
            vec2 boundsSize = uBoundsMax - uBoundsMin;
            vec2 puv = vec2(
              (pos.x - uBoundsMin.x) / boundsSize.x,
              (pos.y - uBoundsMin.y) / boundsSize.y
            );
            
            // Clamp to valid texture coordinates
            puv = clamp(puv, 0.0, 1.0);
            
            // Sample the touch texture to get cursor influence
            float t = texture2D(uTouch, puv).r;
            
            // Apply displacement based on texture value (Codrops approach)
            // The texture value (t) represents how close the cursor trail is to this particle
            // Use subtle displacement for gentle bounce effect
            float rndz = (fract(sin(dot(pos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 2.0;
            float angle = (fract(sin(dot(pos.xy, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0) * 3.14159;
            
            // Subtle displacement for gentle particle bounce (Codrops approach)
            // Small multiplier (5.0) creates gentle motion without distortion
            float displacement = t * 5.0 * rndz;
            pos.z += displacement;
            pos.x += cos(angle) * t * 5.0;
            pos.y += sin(angle) * t * 5.0;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Variable particle size based on brightness - better diversity
            // Invert brightness so darker areas = larger particles
            float invertedBrightness = 1.0 - brightness;
            // Create more size variation: use a wider range (0.3 to 1.0) instead of fixed minimum
            float sizeVariation = 0.3 + invertedBrightness * 0.7; // Range from 0.3 to 1.0
            float psize = sizeVariation * uSize;
            // Perspective attenuation
            psize *= uPixelRatio * (400.0 / -mvPosition.z);
            // Ensure minimum size for visibility but allow smaller particles
            psize = max(psize, 1.5);
            gl_PointSize = psize;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            // Circular particles (matching Codrops tutorial style exactly)
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(center);
            
            if (dist > 0.5) discard;
            
            // Smooth circular falloff with smoothstep (matching Codrops tutorial)
            // Codrops uses: float border = 0.3; float radius = 0.5;
            float border = 0.3;
            float radius = 0.5;
            float distFromCenter = radius - dist;
            float alpha = smoothstep(0.0, border, distFromCenter);
            
            // Apply per-particle opacity (fades in as birds reach them)
            alpha *= vOpacity;
            
            // Use actual image colors (matching Codrops tutorial)
            // For white background: we can use the colors as-is, or slightly darken for better contrast
            // Optionally darken slightly for better visibility on white background
            vec3 finalColor = vColor;
            // Slight darkening for white background (optional - can remove if colors are already dark enough)
            // finalColor = mix(finalColor, vec3(0.0), 0.1); // Darken by 10%
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
      transparent: true,
      vertexColors: true,
      blending: THREE.NormalBlending, // Normal blending works better on white than additive
      depthWrite: false,
      depthTest: true // Enable depth test for better visibility
    })
    
    // Update bounds uniforms with actual calculated values (if available)
    if (imageParticlePositionsRef.current.length > 0) {
      const positions = imageParticlePositionsRef.current
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      positions.forEach(pos => {
        minX = Math.min(minX, pos.x)
        maxX = Math.max(maxX, pos.x)
        minY = Math.min(minY, pos.y)
        maxY = Math.max(maxY, pos.y)
      })
      material.uniforms.uBoundsMin.value.set(minX, minY)
      material.uniforms.uBoundsMax.value.set(maxX, maxY)
      
      // Cache bounds for cursor interaction mapping
      particleBoundsRef.current = { minX, maxX, minY, maxY }
    }
    
    // Create particle system
    console.log(`🔧 Creating THREE.Points: geometry=${!!geometry}, material=${!!material}`)
    const particleSystem = new THREE.Points(geometry, material)
    particleSystem.position.z = 0
    particleSystem.visible = false // Start invisible - birds will morph into particles
    scene.add(particleSystem)
    imageParticleSystemRef.current = particleSystem
    
    // Debug: Check particle positions
    if (targetPositions.length > 0) {
      const firstPos = targetPositions[0]
      const lastPos = targetPositions[targetPositions.length - 1]
      console.log(`🖼️ Image particle system created: ${particleCount} particles`)
      console.log(`📍 Particle position range: first=(${firstPos.x.toFixed(1)}, ${firstPos.y.toFixed(1)}, ${firstPos.z.toFixed(1)}), last=(${lastPos.x.toFixed(1)}, ${lastPos.y.toFixed(1)}, ${lastPos.z.toFixed(1)})`)
      console.log(`📊 Camera at (0, 0, 200) looking at (0, 0, 0)`)
    }
  }

  // Text geometry creation removed - using particles only for now

  function startAnimation() {
    let lastTime = Date.now()

    function animate() {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

      const currentTime = Date.now()
      const elapsed = (currentTime - animationStartTimeRef.current) * 0.001
      const deltaTime = Math.min((currentTime - lastTime) * 0.001, 0.1)
      lastTime = currentTime

      const birds = birdsRef.current

      // Log bird count once per second (only before particles are formed)
      if (!particlesFormedTriggeredRef.current && Math.floor(elapsed) !== Math.floor(elapsed - deltaTime)) {
        const phaseCounts = {
          forming: birds.filter(b => b.animationPhase === 'forming').length,
          flocking: birds.filter(b => b.animationPhase === 'flocking').length,
          revealing: birds.filter(b => b.animationPhase === 'revealing').length
        }
        console.log(`⏱️ T=${elapsed.toFixed(1)}s: ${birds.length} birds -`, phaseCounts)
      }

      birds.forEach((bird, i) => {
        // FORMING PHASE - Birds fade in IMMEDIATELY to match text morph timing
        // No sequential delay - all birds start forming at once
        // The text explosion handles the sequential animation, birds just need to be visible
        const adjustedElapsed = elapsed // No delay - start immediately
        
        if (bird.animationPhase === 'forming') {
          // Only start forming if enough time has passed for this character's position
          if (adjustedElapsed < 0) {
            // Not time yet - keep invisible
            ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 0
            bird.mesh.scale.setScalar(1.0) // Match initial scale (doubled)
            bird.mesh.position.copy(bird.position)
            return
          }
          
          // Birds become visible as text fades out - synchronized transformation
          // BUT: If bird is flying in from offscreen (has velocity), skip fade and make visible immediately
          const isFlyingIn = bird.velocity.lengthSq() > 0.1
          const isButtonBird = bird.isButtonBird === true
          
          if (isFlyingIn) {
            // Button bird: Make visible immediately and fly in first
            if (isButtonBird) {
              // Button bird is always visible, slightly larger, and slate blue-gray
              ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 1
              ;(bird.mesh.material as THREE.MeshPhongMaterial).color.setHex(0x758A93) // Slate blue-gray to match button color
              bird.mesh.scale.setScalar(1.2) // Larger button bird (doubled)
              
              // Apply velocity to move bird (flying in from offscreen)
              bird.position.add(bird.velocity.clone().multiplyScalar(deltaTime))
              bird.mesh.position.copy(bird.position)
              
              // Check if button bird has entered the viewport
              // Birds fly from right to left (negative X direction in world space)
              // Viewport center is at x=0 in world space, right edge is at positive X
              // Button bird starts offscreen to the right (positive X), flies left (toward negative X)
              // Consider it entered when it's crossed into the viewport (x < some threshold)
              // Since button bird starts around x=200-300 in world space, check if it's moved left significantly
              const hasEntered = bird.position.x < 150 // Bird has entered when it's within viewport (x < 150 in world space)
              
              if (hasEntered && !buttonBirdEnteredRef.current) {
                buttonBirdEnteredRef.current = true
                console.log('🐦 Button bird has entered viewport - will allow flock in 0.5 seconds')
                // Set a flag that flock can start entering after button bird has been visible for 0.5 seconds
                if (!flockDelaySetRef.current) {
                  flockDelaySetRef.current = true
                  setTimeout(() => {
                    flockCanEnterRef.current = true
                    console.log('🐦 Flock can now enter - button bird has been visible for 0.5 seconds')
                  }, 500) // 0.5 second delay after button bird enters - shorter delay
                }
              }
              
              // Button bird transitions to flocking once it's entered
              if (adjustedElapsed > 0.1 && buttonBirdEnteredRef.current) {
                bird.animationPhase = 'flocking'
                if (flockingStartTimeRef.current === 0) {
                  flockingStartTimeRef.current = Date.now()
                  console.log('🐦 Button bird started flocking')
                }
              }
            } else {
              // Flock birds: Wait until button bird has entered and delay has passed
              const flockCanEnter = flockCanEnterRef.current
              if (flockCanEnter && buttonBirdEnteredRef.current) {
                // Flock can enter - stagger their activation based on their X position
                // Birds further back (higher X) activate later to create a trailing effect
                const buttonBird = birdsRef.current.find(b => b.isButtonBird)
                if (buttonBird) {
                  const distanceBehind = bird.position.x - buttonBird.position.x
                  // Only activate if bird is far enough behind button bird (at least 150 units in world space)
                  // This creates a natural trailing effect - birds further back activate later
                  // Button bird should be well ahead before flock starts
                  const worldDistanceBehind = distanceBehind
                  if (worldDistanceBehind > 150) {
                    // Make visible and give velocity - slightly slower than button bird
                    ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 1
                    bird.mesh.scale.setScalar(0.8) // Offscreen birds (doubled)
                    
                    // Only activate if they haven't started yet
                    if (bird.velocity.lengthSq() < 0.1 && bird.animationPhase === 'forming') {
                      // Slightly slower than button bird to maintain trailing effect
                      bird.velocity.set(-12, (Math.random() - 0.5) * 3, 0)
                    }
                    // Apply velocity to move bird
                    bird.position.add(bird.velocity.clone().multiplyScalar(deltaTime))
                    bird.mesh.position.copy(bird.position)
                    
                    // Transition to flocking once they have velocity
                    if (bird.velocity.lengthSq() > 0.1) {
                      bird.animationPhase = 'flocking'
                      if (flockingStartTimeRef.current === 0) {
                        flockingStartTimeRef.current = Date.now()
                      }
                    }
                  } else {
                    // Still too close to button bird - keep waiting
                    bird.velocity.set(0, 0, 0)
                    ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 0.3 // Slightly visible but waiting
                    bird.mesh.position.copy(bird.position)
                  }
                }
              } else {
                // Still waiting for button bird to enter - keep stationary and invisible
                bird.velocity.set(0, 0, 0)
                ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 0 // Keep invisible until allowed to enter
                bird.mesh.position.copy(bird.position) // Still update position even if invisible
              }
            }
          } else {
            // Normal birds: Fade in as text fades out
            const formationDuration = 1.5 // Match text fade duration (1.5s)
            const progress = Math.min(adjustedElapsed / formationDuration, 1)
            
            if (progress < 1) {
              // Fade in as text fades out (0.3 to 1.0 opacity over 1.5s)
              const opacity = 0.3 + (progress * 0.7) // From 0.3 to 1.0
              ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = opacity
              bird.mesh.scale.setScalar(0.6 + progress * 1.0) // Grow from 0.6 to 1.6 (doubled)
              
              // Gentle flutter
              bird.mesh.rotation.z = Math.sin(progress * Math.PI * 2) * 0.1
              
              // Start gentle movement immediately
              if (bird.velocity.lengthSq() < 0.01) {
                bird.velocity.set(
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 1
                )
              }
              // Apply velocity for gentle drift
              bird.position.add(bird.velocity.clone().multiplyScalar(deltaTime * 0.5))
              bird.mesh.position.copy(bird.position)
            } else {
              // Normal birds: Transition to flocking after fade completes
              bird.animationPhase = 'flocking'
              // Ensure initial velocity for takeoff (slowed down for better visibility)
              if (bird.velocity.lengthSq() < 1) {
                bird.velocity.set(
                  (Math.random() - 0.5) * 5,
                  (Math.random() - 0.5) * 5,
                  (Math.random() - 0.5) * 3
                )
              }
              ;(bird.mesh.material as THREE.MeshPhongMaterial).opacity = 1
              bird.mesh.scale.setScalar(0.8) // Bird size for active flocking (doubled)
              bird.mesh.rotation.z = 0
              bird.mesh.position.copy(bird.position)
              // Track when first bird starts flocking
              if (flockingStartTimeRef.current === 0) {
                flockingStartTimeRef.current = Date.now()
              }
              if (i < 5) console.log(`🐦 Bird ${i} started flocking at position:`, bird.position, 'velocity:', bird.velocity)
            }
          }
        }
        
        // FLOCKING PHASE - Birds fly around dynamically (based on Three.js GPGPU birds example)
        else if (bird.animationPhase === 'flocking') {
          const acceleration = new THREE.Vector3()
          const flockingBirds = birds.filter(b => b.animationPhase === 'flocking')
          
            // Zone-based boids algorithm (matching GPGPU birds example)
            // Gentle, intimate flocking zones like Three.js example
            const separationDistance = 10.0
            const alignmentDistance = 15.0
            const cohesionDistance = 20.0
          const zoneRadius = separationDistance + alignmentDistance + cohesionDistance
          const zoneRadiusSquared = zoneRadius * zoneRadius
          const separationThresh = separationDistance / zoneRadius
          const alignmentThresh = (separationDistance + alignmentDistance) / zoneRadius
          
          const sep = new THREE.Vector3()
          const align = new THREE.Vector3()
          const coh = new THREE.Vector3()
          let sepCount = 0, alignCount = 0, cohCount = 0
          
          flockingBirds.forEach(other => {
            if (other === bird) return
            
            const dir = new THREE.Vector3().subVectors(other.position, bird.position)
            const dist = dir.length()
            
            if (dist < 0.0001 || dist > zoneRadius) return
            
            const distSquared = dist * dist
            const percent = distSquared / zoneRadiusSquared
            
              if (percent < separationThresh) {
                // Separation zone - avoid crowding (gentler force like GPGPU birds)
                const f = (separationThresh / percent - 1.0) * deltaTime * 0.5 // Gentle separation
                const away = dir.clone().negate().normalize()
                sep.add(away.multiplyScalar(f))
                sepCount++
              } else if (percent < alignmentThresh) {
                // Alignment zone - match velocity (smoother like GPGPU birds)
                const threshDelta = alignmentThresh - separationThresh
                const adjustedPercent = (percent - separationThresh) / threshDelta
                const f = (0.5 - Math.cos(adjustedPercent * Math.PI * 2) * 0.5 + 0.5) * deltaTime * 0.3 // Gentle alignment
                align.add(other.velocity.clone().normalize().multiplyScalar(f))
                alignCount++
              } else {
                // Cohesion zone - move toward center (gentler like GPGPU birds)
                const threshDelta = 1.0 - alignmentThresh
                const adjustedPercent = threshDelta > 0 ? (percent - alignmentThresh) / threshDelta : 1.0
                const f = (0.5 - (Math.cos(adjustedPercent * Math.PI * 2) * -0.5 + 0.5)) * deltaTime * 0.2 // Gentle cohesion
                coh.add(dir.normalize().multiplyScalar(f))
                cohCount++
            }
          })
          
          // Apply forces
          if (sepCount > 0) acceleration.add(sep)
          if (alignCount > 0) acceleration.add(align)
          if (cohCount > 0) acceleration.add(coh)
          
          // Button bird gets a strong forward bias to stay ahead of the flock
          if (bird.isButtonBird) {
            // Ensure button bird stays slate blue-gray and slightly larger
            ;(bird.mesh.material as THREE.MeshPhongMaterial).color.setHex(0x758A93) // Slate blue-gray to match button color
            bird.mesh.scale.setScalar(1.2) // Button bird larger (doubled)
            
            // Calculate average position of other birds
            const otherBirds = flockingBirds.filter(b => !b.isButtonBird)
            if (otherBirds.length > 0) {
              const avgPos = new THREE.Vector3()
              otherBirds.forEach(b => avgPos.add(b.position))
              avgPos.divideScalar(otherBirds.length)
              
              // Strong forward bias - always move forward (toward negative X, which is left/forward)
              const forwardBias = new THREE.Vector3(-1, 0, 0).multiplyScalar(3.0) // Even stronger bias
              acceleration.add(forwardBias)
              
              // Maintain a significant lead in X position (at least 50 units ahead)
              const leadX = avgPos.x - bird.position.x
              if (leadX < 50) { // If button bird is less than 50 units ahead
                const maintainLead = new THREE.Vector3(-1.5, 0, 0) // Strong force to maintain lead
                acceleration.add(maintainLead)
              }
              
              // Reduce cohesion and alignment forces for button bird so it doesn't get pulled back
              // (separation is still applied to avoid collisions)
            }
          }
          
          // Calculate mouse distance once (used for both central attraction and mouse avoidance)
          const toMouse = new THREE.Vector3().subVectors(mouseWorldPosRef.current, bird.position)
          toMouse.z = 0 // Keep in XY plane
          const mouseD = toMouse.length()
          
          // CRITICAL: Define screen boundaries to keep birds on screen during flocking
          const containerWidth = containerRef.current?.clientWidth || window.innerWidth - 201
          const containerHeight = containerRef.current?.clientHeight || window.innerHeight
          const fov = 50 * (Math.PI / 180)
          const distance = 200
          const worldHeight = 2 * Math.tan(fov / 2) * distance
          const worldWidth = worldHeight * (containerWidth / containerHeight)
          
          // Define safe boundaries (use full world space for more freedom)
          const boundaryMargin = 20.0 // Margin from screen edges during flocking
          const maxX = (worldWidth / 2) - boundaryMargin // Use full width (not 80%)
          const minX = -maxX
          const maxY = (worldHeight / 2) - boundaryMargin // Use full height (not 75%)
          const minY = -maxY
          const maxZ = 15.0 // Allow more Z movement during flocking
          const minZ = -15.0
          
          // Central attraction (keep birds in center area - pull toward center)
          // STRONGER to keep most birds concentrated
          const central = new THREE.Vector3(0, 0, 0)
          const toCenter = new THREE.Vector3().subVectors(central, bird.position)
          const distToCenter = toCenter.length()
          
          // Soft boundary zone - gradual increase in force as birds get further from center
          const centerRadius = 80.0 // Reduced preferred center radius
          const maxRadius = 150.0 // Reduced maximum comfortable radius
          
          // Apply central attraction with increasing strength as distance increases
          // Only reduce strength if very close to mouse (to allow mouse interaction)
          const mouseInfluence = mouseD < 150 ? (mouseD / 150) : 1.0 // Reduce attraction near mouse
          
          if (distToCenter > centerRadius) {
            // Calculate attraction strength (stronger as bird gets further)
            const excessDist = distToCenter - centerRadius
            const normalizedExcess = Math.min(excessDist / (maxRadius - centerRadius), 1.0)
              const attractionStrength = 2.0 + normalizedExcess * 4.0 // Gentle: 2.0 to 6.0 strength (like GPGPU birds)
            
            toCenter.normalize()
            toCenter.y *= 1.5 // Slightly stronger vertical component
            acceleration.add(toCenter.multiplyScalar(deltaTime * attractionStrength * mouseInfluence))
          }
          
          // CRITICAL: Apply soft boundary constraints to keep birds on screen during flocking
          // Use gradual forces instead of hard clamping to avoid square patterns
          const boundaryZone = 40.0 // Zone where boundary forces start applying
          const maxBoundaryX = maxX + boundaryZone
          const minBoundaryX = minX - boundaryZone
          const maxBoundaryY = maxY + boundaryZone
          const minBoundaryY = minY - boundaryZone
          const maxBoundaryZ = maxZ + boundaryZone
          const minBoundaryZ = minZ - boundaryZone
          
          // Soft boundary forces - gradual pushback as birds approach edges
          if (bird.position.x > maxX) {
            const excess = bird.position.x - maxX
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0 // 40-100 force
            acceleration.x -= boundaryForce * deltaTime
            // Also add velocity damping to slow down birds heading out - stable damping
            if (bird.velocity.x > 0) {
              bird.velocity.x *= 0.96 - normalizedExcess * 0.08 // Stable damping: 0.96 to 0.88
            }
          } else if (bird.position.x < minX) {
            const excess = minX - bird.position.x
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0
            acceleration.x += boundaryForce * deltaTime
            if (bird.velocity.x < 0) {
              bird.velocity.x *= 0.96 - normalizedExcess * 0.08
            }
          }
          
          if (bird.position.y > maxY) {
            const excess = bird.position.y - maxY
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0
            acceleration.y -= boundaryForce * deltaTime
            if (bird.velocity.y > 0) {
              bird.velocity.y *= 0.96 - normalizedExcess * 0.08
            }
          } else if (bird.position.y < minY) {
            const excess = minY - bird.position.y
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0
            acceleration.y += boundaryForce * deltaTime
            if (bird.velocity.y < 0) {
              bird.velocity.y *= 0.96 - normalizedExcess * 0.08
            }
          }
          
          if (bird.position.z > maxZ) {
            const excess = bird.position.z - maxZ
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0
            acceleration.z -= boundaryForce * deltaTime
            if (bird.velocity.z > 0) {
              bird.velocity.z *= 0.96 - normalizedExcess * 0.08
            }
          } else if (bird.position.z < minZ) {
            const excess = minZ - bird.position.z
            const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
            const boundaryForce = 40.0 + normalizedExcess * 60.0
            acceleration.z += boundaryForce * deltaTime
            if (bird.velocity.z < 0) {
              bird.velocity.z *= 0.96 - normalizedExcess * 0.08
            }
          }
          
          // Additional: Dampen velocities that are pointing away from center (for birds far from center)
          if (distToCenter > centerRadius) {
            // Create a fresh direction vector to center (toCenter was already normalized above)
            const toCenterDir = new THREE.Vector3().subVectors(central, bird.position).normalize()
            const velocityAwayFromCenter = bird.velocity.clone().dot(toCenterDir)
            if (velocityAwayFromCenter > 0) {
              // Bird is moving away from center - apply stable damping
              const damping = 0.96 - (distToCenter - centerRadius) / maxRadius * 0.08 // Stable: 0.96 to 0.88
              bird.velocity.multiplyScalar(damping)
            }
          }
          
          // Mouse avoidance (gentle, like GPGPU birds) - natural and subtle
          const preyRadius = 120.0 // Smaller detection radius for more natural behavior
          
          if (mouseD < preyRadius && mouseD > 0) {
            // Force increases as bird gets closer to mouse - stable and consistent
            // Inverse square law: closer = stronger force
            const normalizedDist = mouseD / preyRadius // 0 to 1
            const forceMultiplier = (1.0 - normalizedDist) * 0.8 // Gentler, more linear
            const f = forceMultiplier * deltaTime * 25 // Much gentler force (like GPGPU birds)
            
            // Calculate flee direction (away from mouse)
            let fleeDirection = toMouse.clone().negate().normalize()
            
            // Add perpendicular component for stable scattering
            // Use bird phase for consistent scatter direction per bird (deterministic, not random)
            const perp = new THREE.Vector3(-fleeDirection.y, fleeDirection.x, 0)
            const scatterAmount = Math.sin(bird.phase + i * 0.5) * 0.8 // Stable, consistent scatter
            fleeDirection = fleeDirection.add(perp.multiplyScalar(scatterAmount)).normalize()
            
            // Add deterministic offset based on bird index (consistent per bird, not random)
            const stableOffset = new THREE.Vector3(
              Math.sin(i * 0.7) * 0.3, // Deterministic based on bird index
              Math.cos(i * 0.9) * 0.3,
              0
            )
            fleeDirection.add(stableOffset).normalize()
            
            // Apply strong repulsion force
            acceleration.add(fleeDirection.multiplyScalar(f))
            
            // Gentle velocity boost when very close to mouse (subtle response)
            if (mouseD < 40) {
              const panicBoost = (1.0 - mouseD / 40) * 5 // Very gentle panic boost
              bird.velocity.add(fleeDirection.multiplyScalar(panicBoost * deltaTime))
            }
          }
          
          // Update velocity and position
          bird.velocity.add(acceleration)
          
          // Gentle flocking movement (matching Three.js GPGPU birds example)
          const FLOCKING_SPEED_LIMIT = 4.0 // Much gentler speed for natural flocking
          if (bird.velocity.length() > FLOCKING_SPEED_LIMIT) {
            bird.velocity.normalize().multiplyScalar(FLOCKING_SPEED_LIMIT)
          }
          
          // Gentle position updates for natural movement
          const FLOCKING_POSITION_MULTIPLIER = 8.0 // Slower, more natural movement
          bird.position.add(bird.velocity.clone().multiplyScalar(deltaTime * FLOCKING_POSITION_MULTIPLIER))
          
          // Soft clamp - only if way outside boundaries (safety net, not hard limit)
          if (bird.position.x > maxBoundaryX) {
            bird.position.x = maxBoundaryX
          } else if (bird.position.x < minBoundaryX) {
            bird.position.x = minBoundaryX
          }
          if (bird.position.y > maxBoundaryY) {
            bird.position.y = maxBoundaryY
          } else if (bird.position.y < minBoundaryY) {
            bird.position.y = minBoundaryY
          }
          if (bird.position.z > maxBoundaryZ) {
            bird.position.z = maxBoundaryZ
          } else if (bird.position.z < minBoundaryZ) {
            bird.position.z = minBoundaryZ
          }
          
          // CRITICAL: Update the mesh position to match!
          bird.mesh.position.copy(bird.position)
          
          // Check reveal - transition to revealing phase (birds morph into particles)
          // Transition in batches for speed: transition 20% of remaining flocking birds per frame
          if ((shouldExitBirdsRef.current || shouldExitBirds) && bird.animationPhase === 'flocking') {
            // Check if particle system is ready
            const imageParticles = imageParticlePositionsRef.current
            const hasImageParticles = imageParticles.length > 0 && imageParticleSystemRef.current !== null
            
            // Don't transition if particles aren't ready
            if (!hasImageParticles) {
              // Keep bird in flocking phase until particles are ready
              return
            }
            
            // Transition birds in batches: only transition 20% of remaining flocking birds per frame
            // This speeds up the transition significantly for large flocks
            const shouldTransition = Math.random() < 0.05 || i < 5 // Always transition first 5, then 5% chance (slower transition)
            
            if (!shouldTransition) {
              return // Skip this bird for now, will transition next frame
            }
            
            bird.animationPhase = 'revealing'
            
            // Track when first bird enters revealing phase (for unassigned particle timing)
            if (firstRevealingBirdTimeRef.current === 0) {
              firstRevealingBirdTimeRef.current = Date.now()
              console.log('⏱️ First bird entered revealing phase - starting unassigned particle fade-in timer')
            }
            
            if (i === 0) {
              console.log(`🚀 Bird 0 transitioning to revealing: hasImageParticles=${hasImageParticles} (${imageParticles.length})`)
            }
            
            // Trigger output ready after birds have been flocking for a while (not immediately on first transition)
            // This ensures the screen doesn't move to output too early
            if (!outputReadyTriggeredRef.current && onOutputReady && flockingStartTimeRef.current > 0) {
              const flockingDuration = (Date.now() - flockingStartTimeRef.current) / 1000
              // Wait until birds have been flocking for at least 3 seconds before showing output
              if (flockingDuration >= 3.0) {
                outputReadyTriggeredRef.current = true
                console.log('✅ Bird-to-particle transition started - calling onOutputReady (after flocking)')
                onOutputReady()
              }
            }
            
            // Assign bird to a particle position
            // Since we have more particles than birds, distribute birds evenly across particles
            // This ensures birds cover the image more evenly for better detail
            const particleIndex = Math.floor((i / birds.length) * imageParticles.length)
            const particlePos = imageParticles[Math.min(particleIndex, imageParticles.length - 1)]
            
            bird.exitTarget = particlePos.clone()
            bird.exitTargetType = 'image'
            bird.faceIndex = particleIndex
            
            // Get color from particle colors array
            const particleColors = imageParticleColorsRef.current
            if (particleColors.length > particleIndex) {
              bird.targetColor = particleColors[particleIndex].clone()
            }
            
            // Give bird gentle initial velocity toward target (particles will speed up later)
            // Start with gentle movement, particles will accelerate during transition
            const toTarget = particlePos.clone().sub(bird.position).normalize()
            // Gentle initial velocity - particles will speed up during morph
            bird.velocity.add(toTarget.multiplyScalar(8.0)) // Gentle initial velocity
            // Add deterministic offset based on bird index (consistent per bird)
            bird.velocity.add(new THREE.Vector3(
              Math.sin(i * 0.5) * 0.5, // Deterministic based on bird index
              Math.cos(i * 0.7) * 0.5,
              Math.sin(i * 0.3) * 0.3
            ))
            
            if (i < 5) {
              console.log(`🎯 Bird ${i} assigned to particle ${particleIndex} at world pos (${particlePos.x.toFixed(1)}, ${particlePos.y.toFixed(1)}, ${particlePos.z.toFixed(1)})`)
            }
          }
        }
        
        // REVEALING PHASE - Birds morph into particles first, then particles move to target positions
        else if (bird.animationPhase === 'revealing') {
          // CRITICAL: Ensure particle system is visible if any bird is in revealing phase
          if (imageParticleSystemRef.current && !imageParticleSystemRef.current.visible) {
            imageParticleSystemRef.current.visible = true
            console.log('🔍 Force-enabling particle system visibility in revealing phase')
          }
          
          // If bird has reached target, keep it locked in place as a particle
          if ((bird as any).atTarget) {
            // Bird is at target - ensure it stays exactly there as a particle
            bird.position.copy(bird.exitTarget!)
            bird.velocity.set(0, 0, 0)
            // CRITICAL: Stop particle velocity to prevent drift
            if (bird.particleVelocity) {
              bird.particleVelocity.set(0, 0, 0)
            }
            
            // Keep bird visible for longer - only hide after unassigned particles are mostly complete
            const unassignedParticleProgress = Math.min(1.0, Math.max(0, (elapsed - 20.0) / 25.0))
            
            // Hide bird only when unassigned particles are 80% complete OR after 35 seconds
            const shouldHideBird = unassignedParticleProgress > 0.8 || elapsed > 35.0
            bird.mesh.visible = !shouldHideBird
            
            bird.mesh.position.copy(bird.position)
            
            // CRITICAL: Continuously ensure particle stays at target and is fully visible
            if (bird.faceIndex !== undefined && imageParticleGeometryRef.current) {
              const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
              const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
              if (positionAttr && opacityAttr) {
                // Always update position and opacity to ensure they stay visible
                positionAttr.setXYZ(bird.faceIndex, bird.exitTarget!.x, bird.exitTarget!.y, bird.exitTarget!.z)
                opacityAttr.setX(bird.faceIndex, 1.0) // CRITICAL: Always set to 1.0
                positionAttr.needsUpdate = true
                opacityAttr.needsUpdate = true
                // Ensure velocity is zero to prevent any movement/drift
                if (bird.particleVelocity) {
                  bird.particleVelocity.set(0, 0, 0)
                }
                
                // Ensure particle system is visible
                if (imageParticleSystemRef.current) {
                  imageParticleSystemRef.current.visible = true
                }
              }
            }
            return // Skip all further processing for this bird
          }
          
          const acceleration = new THREE.Vector3()
          const material = bird.mesh.material as THREE.MeshPhongMaterial
          
          if (bird.exitTarget && bird.exitTargetType !== 'off') {
            // Track morph start time for this bird (morph happens quickly, then particle moves)
            if (!(bird as any).morphStartTime) {
              // First frame in revealing - start morphing immediately
              (bird as any).morphStartTime = elapsed
            }
            
            // STEP 1: Smoothly morph bird into particle over ~6 seconds
            // Track morph progress based on time since entering revealing phase
            // Extended duration allows birds to swoop and circle while changing colors
            const timeSinceMorphStart = elapsed - ((bird as any).morphStartTime || elapsed)
            const MORPH_DURATION = 10.0 // Morph happens over 10 seconds (extended color change and size transition)
            const morphProgress = Math.min(1, timeSinceMorphStart / MORPH_DURATION)
            
            // Smooth easing for morph - use easeInOutCubic for smoother transition
            // This creates a more gradual start and end, with faster middle section
            const smoothProgress = morphProgress < 0.5
              ? 4 * morphProgress * morphProgress * morphProgress
              : 1 - Math.pow(-2 * morphProgress + 2, 3) / 2
            
            // STEP 2: Morph bird into particle (size, color, opacity) over 6 seconds
            // Size transition: happens in first 30% of morph (1.2 seconds)
            const sizeProgress = Math.min(1, morphProgress / 0.3)
            // Button bird starts at scale 0.6, other birds at 0.4 (all smaller now)
            const startScale = bird.isButtonBird ? 0.6 : 0.4 // Smaller bird scales
            const endScale = 0.015 // Particle size
            const currentScale = startScale + (endScale - startScale) * sizeProgress
            bird.mesh.scale.setScalar(currentScale)
            
            // Color morphing: transition from black to target color over full 6 seconds
            // This creates a smooth color change as birds fly around and swoop
            // BUTTON BIRD: Stay slate blue-gray throughout the morph, then transition to target particle color
            if (bird.isButtonBird) {
              // Button bird stays slate blue-gray - morph from slate blue-gray to target particle color
              const buttonBirdColor = new THREE.Color(0x758A93) // Slate blue-gray to match button color
              if (bird.targetColor) {
                // Blend slate blue-gray with target color for seamless transition
                const currentColor = new THREE.Color()
                currentColor.lerpColors(buttonBirdColor, bird.targetColor, smoothProgress * 0.3) // Only 30% toward target to keep it more slate blue-gray
                material.color.copy(currentColor)
              } else {
                // No target color - stay fully slate blue-gray
                material.color.copy(buttonBirdColor)
              }
            } else if (bird.targetColor) {
              const blackColor = new THREE.Color(0x000000)
              const currentColor = new THREE.Color()
              // Use smoothProgress for color (full 6 seconds)
              currentColor.lerpColors(blackColor, bird.targetColor, smoothProgress)
              material.color.copy(currentColor)
            }
            
            // Fade bird out gradually - happens in last 50% of morph (last 2 seconds)
            const fadeStart = 0.5
            const fadeProgress = morphProgress < fadeStart ? 0 : (morphProgress - fadeStart) / (1 - fadeStart)
            const birdOpacity = 1.0 - fadeProgress
            material.opacity = Math.max(0, Math.min(1, birdOpacity))
            
            // Update particle in particle system - make it visible and update its position
            // CRITICAL: Particles appear at bird's current position, not target position
            if (bird.faceIndex !== undefined && imageParticleGeometryRef.current) {
              const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
              const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
              
              if (opacityAttr && positionAttr) {
                // Particle appears as bird morphs - fade in smoothly with staggered timing
                // CRITICAL: Only show particle when bird is close to its target position
                // This ensures particles appear where birds are morphing, not far away
                if (bird.exitTarget) {
                  const distToTarget = bird.position.distanceTo(bird.exitTarget)
                  const maxDistanceForParticle = 50.0 // Only show particle if bird is within 50 units of target
                  
                  // Add a small delay based on bird's faceIndex to stagger particle appearance
                  const particleDelay = bird.faceIndex !== undefined 
                    ? ((bird.faceIndex % 200) / 200) * 1.5 // 0-1.5 second delay based on particle index
                    : 0
                  
                  // Calculate time since this bird started morphing
                  const timeSinceMorphStart = elapsed - ((bird as any).morphStartTime || elapsed)
                  const timeSinceParticleStart = Math.max(0, timeSinceMorphStart - particleDelay)
                  
                  // Particle fades in over 3 seconds after its delay, but only if bird is near target
                  const particleFadeDuration = 3.0
                  const particleFadeProgress = Math.min(1.0, timeSinceParticleStart / particleFadeDuration)
                  
                  // Distance-based opacity - particle is more visible when bird is closer to target
                  const distanceFactor = Math.max(0, 1.0 - (distToTarget / maxDistanceForParticle))
                  
                  // Use smooth easing for particle fade-in
                  const easedProgress = particleFadeProgress < 0.5
                    ? 2 * particleFadeProgress * particleFadeProgress
                    : 1 - Math.pow(-2 * particleFadeProgress + 2, 2) / 2
                  
                  // Combine time-based fade with distance-based visibility
                  const particleOpacity = easedProgress * distanceFactor
                  opacityAttr.setX(bird.faceIndex, Math.min(1.0, particleOpacity))
                  
                  // CRITICAL: During morph, particle stays at bird's current position
                  // This ensures particles appear where birds are, NOT at target positions
                  // Particles will only move to targets AFTER morph completes
                  // Always update position to bird position during morph (even if opacity is 0)
                  // This ensures particle is ready at bird position when it becomes visible
                  positionAttr.setXYZ(bird.faceIndex, bird.position.x, bird.position.y, bird.position.z)
                  
                  // Make particle system visible when first particle appears
                  // This prevents the shape from appearing before birds morph
                  // CRITICAL: Once visible, keep it visible (for white background)
                  if (particleOpacity > 0.1 && imageParticleSystemRef.current) {
                    imageParticleSystemRef.current.visible = true
                  }
                } else {
                  // No target - don't show particle
                  opacityAttr.setX(bird.faceIndex, 0.0)
                  positionAttr.setXYZ(bird.faceIndex, bird.position.x, bird.position.y, bird.position.z)
                }
                
                opacityAttr.needsUpdate = true
                positionAttr.needsUpdate = true
                
                // CRITICAL: Ensure particle system stays visible (important for white background)
                // Always keep it visible once any particle appears
                if (imageParticleSystemRef.current && bird.exitTarget) {
                  const distToTarget = bird.position.distanceTo(bird.exitTarget)
                  if (distToTarget < 50.0) {
                    imageParticleSystemRef.current.visible = true
                  }
                }
              }
            }
            
            // Once morph is complete (6 seconds), bird is now a particle
            // Hide bird mesh completely - particle takes over
            if (smoothProgress >= 1.0 && !(bird as any).morphComplete) {
              bird.mesh.visible = false
              material.opacity = 0
              ;(bird as any).morphComplete = true // Mark morph as complete
              
              // When morph completes, particle should be at bird's final position
              // It will then gradually move to its target position using bezier curve
              if (bird.faceIndex !== undefined && imageParticleGeometryRef.current) {
                const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
                const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
                if (positionAttr && opacityAttr) {
                  // CRITICAL: Set particle to bird's current position (NOT target position)
                  // This ensures the image doesn't appear fully formed
                  // Particle will move to target using bezier curve in the next animation phase
                  const birdFinalPos = bird.position.clone()
                  positionAttr.setXYZ(bird.faceIndex, birdFinalPos.x, birdFinalPos.y, birdFinalPos.z)
                  
                  // Store source position for bezier curve (bird's final position)
                  // Only set once to prevent duplicate animations
                  if (!bird.particleSourcePosition) {
                    bird.particleSourcePosition = birdFinalPos.clone()
                  }
                  
                  // Create swarm position (intermediate waypoint for bezier curve)
                  // This creates a smooth, organic path from bird position to target
                  if (bird.exitTarget && !bird.swarmPosition) {
                    const sourcePos = birdFinalPos.clone()
                    const targetPos = bird.exitTarget.clone()
                    
                    // Calculate swarm position (midpoint with offset for organic path)
                    const midpoint = sourcePos.clone().add(targetPos).multiplyScalar(0.5)
                    const direction = targetPos.clone().sub(sourcePos).normalize()
                    const distance = sourcePos.distanceTo(targetPos)
                    
                    // Create offset perpendicular to direction for organic curve
                    const perpendicular = new THREE.Vector3(
                      -direction.y,
                      direction.x,
                      direction.z * 0.5
                    ).normalize()
                    
                    // Add random offset for organic movement
                    const offsetAmount = distance * 0.3 * (0.5 + Math.random() * 0.5)
                    const randomOffset = perpendicular.multiplyScalar(offsetAmount)
                    randomOffset.add(new THREE.Vector3(
                      (Math.random() - 0.5) * distance * 0.2,
                      (Math.random() - 0.5) * distance * 0.2,
                      (Math.random() - 0.5) * distance * 0.1
                    ))
                    
                    bird.swarmPosition = midpoint.add(randomOffset)
                  }
                  
                  // Particle should already be visible from the morph phase
                  // But ensure it's fully visible now
                  opacityAttr.setX(bird.faceIndex, 1.0)
                  positionAttr.needsUpdate = true
                  opacityAttr.needsUpdate = true
                  
                  // Mark that particle is ready to move to target and start morph timer
                  // Only set these once to prevent duplicate animations
                  if (!(bird as any).particleReadyToMove) {
                    ;(bird as any).particleReadyToMove = true
                    bird.particleMorphStartTime = elapsed
                    bird.particleMorphProgress = 0
                  }
                }
              }
            }
            
            // STEP 3: Move PARTICLE (not bird) to target position using bezier curve
            // Once morph is complete, particle is at bird position and fully visible
            // Now gradually move particle from bird position to target position using smooth bezier curve
            // This creates the gradual, organic formation of the particle art
            if ((bird as any).morphComplete && (bird as any).particleReadyToMove && !(bird as any).atTarget) {
              // Debug: Log particle animation progress for first few birds
              if (i < 3 && Math.floor(elapsed * 2) % 10 === 0) {
                console.log(`🎯 Bird ${i} particle animation: morphComplete=${!!(bird as any).morphComplete}, readyToMove=${!!(bird as any).particleReadyToMove}, atTarget=${!!(bird as any).atTarget}`)
              }
              // Get current particle position from geometry
              if (bird.faceIndex !== undefined && imageParticleGeometryRef.current && bird.exitTarget && bird.swarmPosition) {
                const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
                const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
                
                if (positionAttr && opacityAttr) {
                  // Calculate morph progress (0 to 1) using smooth easing
                  // Extended duration for more gradual, swooping movement
                  const PARTICLE_MORPH_DURATION = 8.0 // 8 seconds for particle to reach target (slower, more graceful movement)
                  const timeSinceMorphStart = bird.particleMorphStartTime ? (elapsed - bird.particleMorphStartTime) : 0
                  let t = Math.min(1, timeSinceMorphStart / PARTICLE_MORPH_DURATION)
                  
                  // Apply smooth easing function (cubic bezier easing: ease-out-cubic)
                  // This matches the example code's smooth morphing
                  t = 1 - Math.pow(1 - t, 3)
                  
                  bird.particleMorphProgress = t
                  
                  // Get current particle position for flocking behavior
                  const currentParticlePos = new THREE.Vector3()
                  currentParticlePos.fromArray(positionAttr.array, bird.faceIndex * 3)
                  
                  // If this is the first frame, initialize particle at bird's final position
                  if (!bird.particleVelocity) {
                    bird.particleVelocity = bird.velocity.clone().multiplyScalar(0.3) // Inherit some bird velocity
                    currentParticlePos.copy(bird.particleSourcePosition || bird.position)
                  }
                  
                  const targetPos = bird.exitTarget!
                  
                  // Apply flocking behavior to particles (like birds but focused on target)
                  const particleAcceleration = new THREE.Vector3()
                  
                  // 1. Attraction to target (primary force - STRONGER and increases as approaching)
                  const toTarget = targetPos.clone().sub(currentParticlePos)
                  const distanceToTarget = toTarget.length()
                  if (distanceToTarget > 0.1) {
                    // Stronger attraction that increases as particle gets closer
                    // Use inverse distance weighting: closer = stronger pull
                    const distanceFactor = Math.max(0.1, 1.0 / (distanceToTarget + 1.0))
                    const targetForceStrength = Math.min(50.0, distanceToTarget * 1.5 + distanceFactor * 30.0)
                    const targetForce = toTarget.normalize().multiplyScalar(targetForceStrength)
                    particleAcceleration.add(targetForce.multiplyScalar(deltaTime))
                  }
                  
                  // 2. Flocking with other particles (creates swooping motion)
                  // REDUCE flocking influence as particle approaches target
                  const flockingInfluence = Math.max(0.1, 1.0 - t * 0.9) // Reduce to 10% when close
                  
                  const otherParticles = birds.filter(b => 
                    b !== bird && 
                    (b as any).morphComplete && 
                    (b as any).particleReadyToMove && 
                    !(b as any).atTarget &&
                    b.faceIndex !== undefined
                  )
                  
                  if (otherParticles.length > 0) {
                    // Separation, alignment, cohesion (like bird flocking)
                    const separationRadius = 8.0
                    const alignmentRadius = 15.0
                    const cohesionRadius = 20.0
                    
                    const separation = new THREE.Vector3()
                    const alignment = new THREE.Vector3()
                    const cohesion = new THREE.Vector3()
                    let sepCount = 0, alignCount = 0, cohCount = 0
                    
                    otherParticles.forEach(otherBird => {
                      const otherPos = new THREE.Vector3()
                      otherPos.fromArray(positionAttr.array, otherBird.faceIndex! * 3)
                      
                      const diff = currentParticlePos.clone().sub(otherPos)
                      const dist = diff.length()
                      
                      if (dist > 0 && dist < cohesionRadius) {
                        if (dist < separationRadius) {
                          // Separation: avoid crowding
                          separation.add(diff.normalize().multiplyScalar(separationRadius - dist))
                          sepCount++
                        } else if (dist < alignmentRadius) {
                          // Alignment: match velocity direction
                          if (otherBird.particleVelocity) {
                            alignment.add(otherBird.particleVelocity.clone().normalize())
                            alignCount++
                          }
                        } else {
                          // Cohesion: move toward group center
                          cohesion.add(otherPos)
                          cohCount++
                        }
                      }
                    })
                    
                    // Apply flocking forces with reduced influence near target
                    if (sepCount > 0) {
                      separation.divideScalar(sepCount)
                      particleAcceleration.add(separation.multiplyScalar(deltaTime * 2.0 * flockingInfluence))
                    }
                    if (alignCount > 0) {
                      alignment.divideScalar(alignCount)
                      particleAcceleration.add(alignment.multiplyScalar(deltaTime * 0.5 * flockingInfluence))
                    }
                    if (cohCount > 0) {
                      cohesion.divideScalar(cohCount)
                      const cohesionForce = cohesion.sub(currentParticlePos).normalize()
                      particleAcceleration.add(cohesionForce.multiplyScalar(deltaTime * 0.3 * flockingInfluence))
                    }
                  }
                  
                  // 3. Add some organic swooping motion (REDUCE as approaching target)
                  const swoopForce = new THREE.Vector3(
                    Math.sin(elapsed * 2.0 + bird.faceIndex * 0.1) * 0.5,
                    Math.cos(elapsed * 1.5 + bird.faceIndex * 0.15) * 0.3,
                    Math.sin(elapsed * 2.5 + bird.faceIndex * 0.08) * 0.2
                  )
                  // Reduce swoop significantly as approaching target
                  particleAcceleration.add(swoopForce.multiplyScalar(deltaTime * (1.0 - t) * (1.0 - t) * 1.0 * flockingInfluence))
                  
                  // Update particle velocity and position
                  bird.particleVelocity.add(particleAcceleration)
                  
                  // Speed limit for particles
                  const maxSpeed = 8.0 + t * 12.0 // Speed up as approaching target
                  if (bird.particleVelocity.length() > maxSpeed) {
                    bird.particleVelocity.normalize().multiplyScalar(maxSpeed)
                  }
                  
                  // Update position
                  const newParticlePos = currentParticlePos.add(bird.particleVelocity.clone().multiplyScalar(deltaTime * 10.0))
                  
                  // Update particle position in geometry
                  positionAttr.setXYZ(bird.faceIndex, newParticlePos.x, newParticlePos.y, newParticlePos.z)
                  
                  // CRITICAL: Keep particle fully visible during movement
                  opacityAttr.setX(bird.faceIndex, 1.0)
                  
                  positionAttr.needsUpdate = true
                  opacityAttr.needsUpdate = true
                  
                  // Check if particle has reached target (or close enough)
                  const finalDistToTarget = newParticlePos.distanceTo(targetPos)
                  // Increase threshold to 8.0 units to account for flocking interference
                  // Also check if time-based progress is complete OR if very close to target
                  if (t >= 1.0 || finalDistToTarget < 8.0) {
                    // Particle has reached target - lock it in place
                    positionAttr.setXYZ(bird.faceIndex, targetPos.x, targetPos.y, targetPos.z)
                    opacityAttr.setX(bird.faceIndex, 1.0) // Ensure it stays visible
                    positionAttr.needsUpdate = true
                    opacityAttr.needsUpdate = true
                    ;(bird as any).atTarget = true
                    bird.particleMorphProgress = 1.0
                    // Stop particle velocity to prevent drift
                    if (bird.particleVelocity) {
                      bird.particleVelocity.set(0, 0, 0)
                    }
                  }
                }
              }
            }
          } else {
            // Bird doesn't have a target - keep it visible and in place
            // (This shouldn't happen, but handle gracefully)
            if (i === 0 && Math.floor(elapsed * 10) % 20 === 0) {
              console.warn(`⚠️ Bird ${i} in revealing phase but has no target (exitTarget=${!!bird.exitTarget}, type=${bird.exitTargetType})`)
            }
            bird.velocity.multiplyScalar(0.92) // Stable slowdown
          }
          
          // Only update bird physics if morph isn't complete yet
          // Once morph is complete, bird is hidden and particle moves independently
          if (!(bird as any).morphComplete) {
            // Get morph progress for gradual target attraction
            const timeSinceMorphStart = elapsed - ((bird as any).morphStartTime || elapsed)
            const MORPH_DURATION = 10.0 // Extended to 10 seconds for much more swooping
            const morphProgress = Math.min(1, timeSinceMorphStart / MORPH_DURATION)
            
            // CRITICAL: Define screen boundaries to keep birds on screen
            // Use the same calculations as particle system (FOV 50, distance 200)
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth - 201
            const containerHeight = containerRef.current?.clientHeight || window.innerHeight
            const fov = 50 * (Math.PI / 180)
            const distance = 200
            const worldHeight = 2 * Math.tan(fov / 2) * distance
            const worldWidth = worldHeight * (containerWidth / containerHeight)
            
            // Define safe boundaries (use full world space during revealing phase)
            const boundaryMargin = 20.0 // Margin from screen edges
            const maxX = (worldWidth / 2) - boundaryMargin // Use full width
            const minX = -maxX
            const maxY = (worldHeight / 2) - boundaryMargin // Use full height
            const minY = -maxY
            const maxZ = 10.0 // Allow some Z movement
            const minZ = -5.0
            
            // CRITICAL: Strong attraction to target so birds stay near their target positions
            // Birds should gradually approach their targets and morph in place, not fly away
            if (bird.exitTarget) {
              const toTarget = bird.exitTarget.clone().sub(bird.position)
              const distToTarget = toTarget.length()
              
              // Gentle attraction that increases gradually as particles need to speed up
              // Start gentle like flocking, then accelerate for particle formation
              const baseAttraction = 15.0 // Gentle base attraction (like flocking)
              const progressAttraction = morphProgress * 50.0 // Accelerates to 65.0 total for particle formation
              const attractionStrength = baseAttraction + progressAttraction
              
              if (distToTarget > 0.1) {
                toTarget.normalize()
                bird.velocity.add(toTarget.multiplyScalar(deltaTime * attractionStrength))
              } else {
                // Very close to target - slow down and stay near it
                bird.velocity.multiplyScalar(0.75) // Damping near target for revealing phase
              }
              
              // Add very gentle circular motion around target for organic feel (only when very close)
              if (distToTarget < 15.0 && distToTarget > 1.0) {
                const perp = new THREE.Vector3(-toTarget.y, toTarget.x, 0).normalize()
                const swirlAmount = 0.08 * (1 - morphProgress) * (1 - distToTarget / 15.0) // Stable, gentle
                bird.velocity.add(perp.multiplyScalar(deltaTime * swirlAmount * 2.0))
              }
            }
            
            // CRITICAL: Apply soft boundary constraints to keep birds on screen
            // Use gradual forces instead of hard clamping to avoid square patterns
            const boundaryZone = 30.0 // Zone where boundary forces start applying
            const maxBoundaryX = maxX + boundaryZone
            const minBoundaryX = minX - boundaryZone
            const maxBoundaryY = maxY + boundaryZone
            const minBoundaryY = minY - boundaryZone
            const maxBoundaryZ = maxZ + boundaryZone
            const minBoundaryZ = minZ - boundaryZone
            
            // Soft boundary forces - gradual pushback as birds approach edges
            if (bird.position.x > maxX) {
              const excess = bird.position.x - maxX
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0 // 30-70 force
              bird.velocity.x -= boundaryForce * deltaTime
            } else if (bird.position.x < minX) {
              const excess = minX - bird.position.x
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0
              bird.velocity.x += boundaryForce * deltaTime
            }
            
            if (bird.position.y > maxY) {
              const excess = bird.position.y - maxY
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0
              bird.velocity.y -= boundaryForce * deltaTime
            } else if (bird.position.y < minY) {
              const excess = minY - bird.position.y
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0
              bird.velocity.y += boundaryForce * deltaTime
            }
            
            if (bird.position.z > maxZ) {
              const excess = bird.position.z - maxZ
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0
              bird.velocity.z -= boundaryForce * deltaTime
            } else if (bird.position.z < minZ) {
              const excess = minZ - bird.position.z
              const normalizedExcess = Math.min(excess / boundaryZone, 1.0)
              const boundaryForce = 30.0 + normalizedExcess * 40.0
              bird.velocity.z += boundaryForce * deltaTime
            }
            
            // Soft clamp - only if way outside boundaries (safety net)
            if (bird.position.x > maxBoundaryX) {
              bird.position.x = maxBoundaryX
            } else if (bird.position.x < minBoundaryX) {
              bird.position.x = minBoundaryX
            }
            if (bird.position.y > maxBoundaryY) {
              bird.position.y = maxBoundaryY
            } else if (bird.position.y < minBoundaryY) {
              bird.position.y = minBoundaryY
            }
            if (bird.position.z > maxBoundaryZ) {
              bird.position.z = maxBoundaryZ
            } else if (bird.position.z < minBoundaryZ) {
              bird.position.z = minBoundaryZ
            }
            
            // Apply minimal flocking forces - birds should focus on reaching targets
            // Only apply very weak flocking to keep minimal organic movement
            const reducedAcceleration = acceleration.clone().multiplyScalar(0.1 * (1 - morphProgress))
            bird.velocity.add(reducedAcceleration)
            
            // Gradually increase speed as particles need to form the art
            // Start gentle like flocking, then accelerate for particle formation
            const baseSpeedLimit = 4.0 // Same as flocking
            const maxSpeedLimit = 20.0 // Maximum for particle formation
            const currentSpeedLimit = baseSpeedLimit + (maxSpeedLimit - baseSpeedLimit) * morphProgress
            
            if (bird.velocity.length() > currentSpeedLimit) {
              bird.velocity.normalize().multiplyScalar(currentSpeedLimit)
            }
            
            // Gradually increase position multiplier as particles need to form
            const basePositionMultiplier = 8.0 // Same as flocking
            const maxPositionMultiplier = 18.0 // Maximum for particle formation
            const currentPositionMultiplier = basePositionMultiplier + (maxPositionMultiplier - basePositionMultiplier) * morphProgress
            
            bird.position.add(bird.velocity.clone().multiplyScalar(deltaTime * currentPositionMultiplier))
            
            // Soft clamp - only if way outside boundaries (safety net, not hard limit)
            if (bird.position.x > maxBoundaryX) {
              bird.position.x = maxBoundaryX
            } else if (bird.position.x < minBoundaryX) {
              bird.position.x = minBoundaryX
            }
            if (bird.position.y > maxBoundaryY) {
              bird.position.y = maxBoundaryY
            } else if (bird.position.y < minBoundaryY) {
              bird.position.y = minBoundaryY
            }
            if (bird.position.z > maxBoundaryZ) {
              bird.position.z = maxBoundaryZ
            } else if (bird.position.z < minBoundaryZ) {
              bird.position.z = minBoundaryZ
            }
            
            // CRITICAL: Update the mesh position to match!
            bird.mesh.position.copy(bird.position)
          } else {
            // Morph complete - bird is hidden, particle moves independently
            // No need to update bird position
          }
        }
        
        // Orient bird
        if (bird.velocity.length() > 0.1 && bird.animationPhase !== 'forming') {
          const dir = bird.velocity.clone().normalize()
          bird.mesh.rotation.y = Math.atan2(-dir.z, dir.x)
          bird.mesh.rotation.z = Math.asin(Math.max(-1, Math.min(1, dir.y)))
          
          // Flap wings - Boid style wing animation
          // Match the Boid example exactly: vertices[4].y = vertices[5].y = Math.sin(phase) * 5
          bird.phase += deltaTime * 20
          const flap = Math.sin(bird.phase) * 5 // Match Boid example amplitude
          const positions = (bird.mesh.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array
          // Vertex 4 (left wing tip): index 13 is Y coordinate (4 * 3 + 1)
          // Vertex 5 (right wing tip): index 16 is Y coordinate (5 * 3 + 1)
          // Both wing tips flap together with same Y value (like Boid example)
          positions[13] = flap // Vertex 4 Y (left wing tip)
          positions[16] = flap // Vertex 5 Y (right wing tip) - same value as vertex 4
          bird.mesh.geometry.attributes.position.needsUpdate = true
        }
      })

      // Check if most birds have taken flight before fading UI
      // Fade as soon as the last word/letter takes off
      if (!flightHasBegunRef.current && onFlightBegins && birds.length > 0) {
        const flockingBirds = birds.filter(b => b.animationPhase === 'flocking')
        const flockingPercentage = flockingBirds.length / birds.length
        
        // Fade as soon as 95% of birds are flocking (last words have taken off)
        if (flockingPercentage >= 0.95) {
          flightHasBegunRef.current = true
          onFlightBegins()
          console.log(`✈️ Flight begins - ${flockingBirds.length}/${birds.length} birds flocking (${(flockingPercentage * 100).toFixed(0)}%) at ${elapsed.toFixed(1)}s - fading input UI`)
        }
      }

      // Trigger exit after birds have flocked (check once per frame, not per bird)
      // Total animation should take ~8 seconds: 2-3s flocking + 5-6s morphing
      // IMPORTANT: Wait for particle system to be ready before triggering exit
      if (!exitTriggeredRef.current && flockingStartTimeRef.current > 0) {
        const flockingDuration = (Date.now() - flockingStartTimeRef.current) / 1000
        const totalDuration = elapsed // Total time since animation started
        
        // Check if particle system is ready (replaced image plane with particles)
        const particleSystemReady = imageParticleSystemRef.current !== null && imageParticlePositionsRef.current.length > 0
        
        // Birds should flock on InputPage for ~5-6 seconds (visible flying)
        // Then continue flocking on LoadingPage for another ~4-5 seconds
        // Then start morphing into particles
        // This ensures birds are actively flying on InputPage before transition
        const FLOCKING_DURATION = 10.0 // Birds flock for 10 seconds total (5-6s on Input, 4-5s on Loading)
        const MORPH_DELAY = 2.0 // Delay between flocking ending and morph starting
        const timeCondition = flockingDuration > (FLOCKING_DURATION + MORPH_DELAY) || totalDuration > 7.0
        
        // Only trigger if time condition is met AND particle system is ready
        // If particle system isn't ready yet, log why
        if (timeCondition && !particleSystemReady) {
          if (Math.floor(elapsed * 10) % 30 === 0) { // Log every 3 seconds
            console.log(`⏳ Waiting for particle system: hasSystem=${!!imageParticleSystemRef.current}, hasPositions=${imageParticlePositionsRef.current.length > 0}`)
          }
        }
        
        const shouldTriggerExit = timeCondition && particleSystemReady
        
        if (shouldTriggerExit) {
          console.log(`🚪 Triggering exit: flockingDuration=${flockingDuration.toFixed(1)}s, totalDuration=${totalDuration.toFixed(1)}s, particleSystemReady=${particleSystemReady}`)
          exitTriggeredRef.current = true // Prevent multiple triggers
          shouldExitBirdsRef.current = true // Set ref immediately (available this frame)
          setShouldExitBirds(true) // Set state (available next frame)
          
          // Old canvas-based reveal code removed - using particles now
          
        }
      }

      // Fade touch canvas over time to create trail effect (Codrops approach)
      if (touchContextRef.current && touchCanvasRef.current) {
        const ctx = touchContextRef.current
        const canvas = touchCanvasRef.current
        
        // Fade the canvas by drawing a semi-transparent black rectangle over it
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Update texture
        if (touchTextureRef.current) {
          touchTextureRef.current.needsUpdate = true
        }
      }
      
      // Update particle system uniforms for mouse interaction
      // CRITICAL: Always update if particle system exists and has particles
      if (imageParticleSystemRef.current && imageParticleGeometryRef.current) {
        const hasRevealingBirds = birds.some(b => b.animationPhase === 'revealing')
        
        // CRITICAL: Only make particle system visible when birds start morphing
        // Particles assigned to birds will be positioned at bird locations during morph, then move to targets
        // Unassigned particles should gradually appear at their target positions
        if (hasRevealingBirds) {
          imageParticleSystemRef.current.visible = true
          
          // Make unassigned particles visible ONLY after birds have completed their animation
          // This prevents premature image appearance while ensuring the full image forms
          const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
          const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
          const targetPositions = imageParticlePositionsRef.current
          
          if (positionAttr && opacityAttr && targetPositions.length > 0) {
            // Get all bird-assigned particle indices
            const assignedIndices = new Set<number>()
            birds.forEach(bird => {
              if (bird.faceIndex !== undefined) {
                assignedIndices.add(bird.faceIndex)
              }
            })
            
            // Organically reveal unassigned particles with scattered, natural progression
            const revealingBirds = birds.filter(b => b.animationPhase === 'revealing')
            const birdsAtTarget = revealingBirds.filter(b => (b as any).atTarget).length
            
            // Start revealing unassigned particles when ANY birds reach targets
            if (birdsAtTarget > 0) {
              const totalUnassignedParticles = positionAttr.count - assignedIndices.size
              
              // Sync unassigned particles to complete when last bird reaches target
              const birdProgress = Math.min(1.0, birdsAtTarget / Math.max(1, revealingBirds.length))
              
              // Calculate when last bird will likely reach target based on current progress (adjusted for slower transitions)
              const estimatedCompletionTime = 20.0 + (birdProgress < 0.1 ? 25.0 : 15.0 / Math.max(0.1, birdProgress))
              const syncedTimeProgress = Math.min(1.0, Math.max(0, (elapsed - 20.0) / (estimatedCompletionTime - 20.0)))
              
              // Add bird activity influence - more active birds = more particle bursts
              const birdActivity = revealingBirds.reduce((activity, bird) => {
                const speed = bird.velocity.length()
                return activity + Math.min(1.0, speed / 5.0) // Normalize speed to 0-1
              }, 0) / Math.max(1, revealingBirds.length)
              
              // Create bursts of particles when birds are active
              const activityBoost = Math.sin(elapsed * 3.0) * birdActivity * 0.3 // Oscillating boost based on activity
              
              // Accelerate particles when birds are close to completion
              const accelerationFactor = birdProgress > 0.6 ? 1.0 + (birdProgress - 0.6) * 2.5 : 1.0 // Up to 2x faster when 60%+ birds at target
              const combinedProgress = Math.max(birdProgress * 0.9, syncedTimeProgress * accelerationFactor) + activityBoost
              
              const targetVisibleParticles = Math.floor(totalUnassignedParticles * Math.min(1.0, combinedProgress))
              
              // Debug: Log progress occasionally
              if (Math.floor(elapsed * 2) % 30 === 0) {
                console.log(`🌟 Synced reveal: ${birdsAtTarget}/${revealingBirds.length} birds (${(birdProgress * 100).toFixed(1)}%), synced: ${(syncedTimeProgress * 100).toFixed(1)}%, accel: ${accelerationFactor.toFixed(1)}x, showing ${targetVisibleParticles}/${totalUnassignedParticles} particles`)
              }
              
              // Create organic, scattered appearance pattern
              // Use distance from center and random-like distribution for natural look
              const unassignedParticles: Array<{index: number, priority: number}> = []
              
              for (let i = 0; i < positionAttr.count && i < targetPositions.length; i++) {
                if (!assignedIndices.has(i)) {
                  const target = targetPositions[i]
                  
                  // Calculate distance from center for organic spreading
                  const distFromCenter = Math.sqrt(target.x * target.x + target.y * target.y)
                  
                  // Create dynamic priority influenced by nearby bird activity
                  const centerWeight = 1.0 - Math.min(1.0, distFromCenter / 100.0) // Prefer center first
                  
                  // Find influence from nearby birds (birds create "wake" effects)
                  let birdInfluence = 0
                  revealingBirds.forEach(bird => {
                    const birdDist = Math.sqrt(
                      (target.x - bird.position.x) ** 2 + 
                      (target.y - bird.position.y) ** 2
                    )
                    if (birdDist < 50.0) { // Birds influence particles within 50 units
                      const influence = (1.0 - birdDist / 50.0) * bird.velocity.length() / 10.0
                      birdInfluence += influence
                    }
                  })
                  birdInfluence = Math.min(1.0, birdInfluence)
                  
                  // Time-varying randomness that creates waves of particle appearance
                  const timeVariation = Math.sin(elapsed * 2.0 + i * 0.1) * 0.5 + 0.5
                  const pseudoRandom = Math.sin(i * 7.3) * Math.cos(i * 11.7) * 0.5 + 0.5
                  const dynamicRandom = (pseudoRandom + timeVariation * 0.3) / 1.3
                  
                  // Combine influences: center-out + bird activity + dynamic randomness
                  const priority = centerWeight * 0.4 + birdInfluence * 0.3 + dynamicRandom * 0.3
                  
                  unassignedParticles.push({index: i, priority})
                }
              }
              
              // Sort by priority for organic appearance order
              unassignedParticles.sort((a, b) => b.priority - a.priority)
              
              // Make particles visible up to target count with smooth fade-in
              for (let j = 0; j < Math.min(targetVisibleParticles, unassignedParticles.length); j++) {
                const particleData = unassignedParticles[j]
                const i = particleData.index
                const target = targetPositions[i]
                
                // Position particle at target
                positionAttr.setXYZ(i, target.x, target.y, target.z)
                
                // Dynamic fade-in with random timing variations
                const currentOpacity = opacityAttr.getX(i)
                const baseDelay = (1.0 - particleData.priority) * 2.0
                
                // Add random timing variation that changes over time
                const randomVariation = Math.sin(elapsed * 1.5 + i * 0.05) * 0.5 // ±0.5 second variation
                const fadeDelay = baseDelay + randomVariation
                const timeSinceStart = elapsed - 12.0 - fadeDelay
                
                if (timeSinceStart > 0) {
                  // Variable fade speed based on bird activity nearby
                  let localBirdActivity = 0
                  revealingBirds.forEach(bird => {
                    const birdDist = Math.sqrt(
                      (target.x - bird.position.x) ** 2 + 
                      (target.y - bird.position.y) ** 2
                    )
                    if (birdDist < 30.0) {
                      localBirdActivity += (1.0 - birdDist / 30.0) * bird.velocity.length() / 10.0
                    }
                  })
                  
                  const baseFadeSpeed = 1.5
                  const activityBoost = Math.min(2.0, localBirdActivity * 3.0) // Up to 3x faster near active birds
                  const fadeSpeed = baseFadeSpeed + activityBoost
                  
                  const targetOpacity = 1.0
                  const newOpacity = Math.min(targetOpacity, currentOpacity + fadeSpeed * (1/60))
                  opacityAttr.setX(i, newOpacity)
                } else {
                  // Not ready to fade in yet
                  opacityAttr.setX(i, 0.0)
                }
              }
              
              positionAttr.needsUpdate = true
              opacityAttr.needsUpdate = true
            }
          }
        }
        
        // Debug: Check particle opacities periodically (only before particles are formed)
        if (!particlesFormedTriggeredRef.current && hasRevealingBirds && Math.floor(elapsed * 2) % 5 === 0) {
          const opacityAttr = imageParticleGeometryRef.current.getAttribute('opacity') as THREE.BufferAttribute
          if (opacityAttr) {
            let visibleCount = 0
            let totalCount = 0
            for (let i = 0; i < opacityAttr.count; i++) {
              const opacity = opacityAttr.getX(i)
              if (opacity > 0) visibleCount++
              totalCount++
            }
            console.log(`🔍 Particle visibility check: ${visibleCount}/${totalCount} particles visible, system visible=${imageParticleSystemRef.current.visible}`)
          }
        }
        
        const material = imageParticleSystemRef.current.material as THREE.ShaderMaterial
        if (material.uniforms) {
          material.uniforms.uTime.value = elapsed
          material.uniforms.uMousePos.value.copy(mousePositionRef.current)
        }
      }
      
      // Show final content when most birds have reached their particle positions
      const allRevealingBirds = birds.filter(b => b.animationPhase === 'revealing')
      const birdsAtTarget = allRevealingBirds.filter(b => {
        // Check if bird is marked as atTarget (most reliable)
        if ((b as any).atTarget) {
          return true
        }
        // Fallback: check particle position if available
        if (b.exitTarget && b.faceIndex !== undefined && imageParticleGeometryRef.current) {
          const positionAttr = imageParticleGeometryRef.current.getAttribute('position') as THREE.BufferAttribute
          if (positionAttr) {
            const particlePos = new THREE.Vector3(
              positionAttr.getX(b.faceIndex),
              positionAttr.getY(b.faceIndex),
              positionAttr.getZ(b.faceIndex)
            )
            const dist = particlePos.distanceTo(b.exitTarget)
            return dist < 2.0 // Particle has reached its target (more precise)
          }
        }
        // Last resort: check bird position (only if morph not complete)
        if (b.exitTarget && !(b as any).morphComplete) {
          const dist = b.position.distanceTo(b.exitTarget)
          return dist < 2.0 // More precise threshold
        }
        return false
      }).length
      
      // Debug: Log progress periodically (only before particles are formed)
      if (!particlesFormedTriggeredRef.current && allRevealingBirds.length > 0 && Math.floor(elapsed * 2) % 3 === 0) {
        const progress = (birdsAtTarget / allRevealingBirds.length) * 100
        console.log(`📊 Particle formation progress: ${birdsAtTarget}/${allRevealingBirds.length} birds at targets (${progress.toFixed(1)}%)`)
      }
      
      // Time-based fallback: if all birds are in revealing phase for 3+ seconds, consider particles formed
      const allBirdsRevealing = birds.length > 0 && birds.every(b => b.animationPhase === 'revealing')
      
      // Track when all birds first entered revealing phase
      if (allBirdsRevealing && allBirdsRevealingStartTimeRef.current === 0) {
        allBirdsRevealingStartTimeRef.current = Date.now()
        console.log('⏱️ All birds entered revealing phase - starting timer')
      }
      
      // Calculate time since all birds started revealing
      const timeSinceAllRevealing = allBirdsRevealing && allBirdsRevealingStartTimeRef.current > 0 
        ? (Date.now() - allBirdsRevealingStartTimeRef.current) / 1000 
        : 0
      // Wait for full morph duration (6 seconds) plus buffer for particles to reach targets
      const timeBasedReady = allBirdsRevealing && timeSinceAllRevealing > 12.0 // 6s morph + 4s particle movement + 2s buffer
      
      // Debug: Log time-based check periodically (only before particles are formed)
      if (!particlesFormedTriggeredRef.current && allBirdsRevealing && allBirdsRevealingStartTimeRef.current > 0 && Math.floor(elapsed * 2) % 3 === 0) {
        console.log(`⏱️ Time-based check: ${timeSinceAllRevealing.toFixed(1)}s since all birds revealing (need 12.0s)`)
      }
      
      // Notify when particles are fully formed (70%+ birds at targets OR all birds revealing for 12+ seconds)
      const particlesReady = allRevealingBirds.length > 0 && ((birdsAtTarget / allRevealingBirds.length) > 0.7 || timeBasedReady)
      
      // Debug: Log condition evaluation (only before particles are formed)
      if (!particlesFormedTriggeredRef.current && allRevealingBirds.length > 0 && timeBasedReady && Math.floor(elapsed * 2) % 5 === 0) {
        console.log(`🔍 particlesReady check: allRevealingBirds=${allRevealingBirds.length}, birdsAtTarget=${birdsAtTarget}, timeBasedReady=${timeBasedReady}, particlesReady=${particlesReady}, hasCallback=${!!onParticlesFormed}`)
      }
      
      if (particlesReady) {
        if (!showFinalContent) {
          setShowFinalContent(true)
          if (onRevealComplete && !revealCompleteTriggeredRef.current) {
            revealCompleteTriggeredRef.current = true
            onRevealComplete()
          }
        }
        
        // Notify when particles are fully formed (separate callback for text display)
        if (!particlesFormedTriggeredRef.current && onParticlesFormed) {
          particlesFormedTriggeredRef.current = true
          const reason = timeBasedReady ? 'time-based (all birds revealing for 3s)' : `${((birdsAtTarget / allRevealingBirds.length) * 100).toFixed(1)}% at targets`
          console.log(`✅ Particles fully formed: ${birdsAtTarget}/${allRevealingBirds.length} birds at targets - ${reason}`)
          console.log(`📞 Calling onParticlesFormed callback`)
          onParticlesFormed()
        } else if (!particlesFormedTriggeredRef.current) {
          console.warn(`⚠️ particlesReady=true but onParticlesFormed not provided or already triggered`)
        }
      }

      // Fade touch canvas texture for natural cursor trail decay (Codrops approach)
      // This creates the smooth fade-out effect instead of persistent trails
      if (touchContextRef.current && touchCanvasRef.current) {
        const ctx = touchContextRef.current
        const canvas = touchCanvasRef.current
        
        // Create slight opacity fade by drawing a semi-transparent black rectangle
        // This gradually fades out the cursor trail over time
        ctx.fillStyle = 'rgba(0, 0, 0, 0.015)' // Very subtle fade each frame (~98.5% retention per frame)
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // Render the scene - ensure background is cleared properly
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Explicitly clear to ensure background color is rendered
        rendererRef.current.clear()
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    console.log('🎬 Animation loop started')
    console.log(`📊 Scene has ${sceneRef.current?.children.length || 0} objects`)
    animate()
  }

  console.log('🎨 RENDER: ExplodingTextToBirds rendering with skipExplosion:', skipExplosion)
  
  return (
    <div ref={containerRef} style={{ 
      // Fixed positioning accounting for sidebar (201px) and header (80px)
      position: 'fixed',
      top: '80px', // Below header
      left: '201px', // Start at sidebar edge (no gap)
      right: 0, // Extend all the way to right edge
      bottom: 0,
      width: 'calc(100% - 201px)', // Full width from sidebar to right edge
      height: 'calc(100vh - 80px)', // Account for header
      margin: 0,
      padding: 0,
      overflow: 'hidden', // Prevent any overflow
      maxWidth: 'none',
      zIndex: 100, // Lower than ButtonToBird (99999) so button animation appears on top
      pointerEvents: 'auto',
      background: 'transparent',
      display: 'block',
    }}>
      {/* Text container for explosion animation - only render if explosion happens on this page */}
      {!skipExplosion && (
        <div 
          ref={textContainerRef}
          style={{
            position: 'fixed',
            zIndex: 101,
            pointerEvents: 'none',
            visibility: 'hidden', // Hidden - explosion will make it visible and replace content
            opacity: 0
          }}
        >
            <h2 style={{
              fontSize: '1.125rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: '#000000',
              whiteSpace: 'normal',
              margin: 0,
              padding: '0.5rem 0',
              textAlign: 'left',
              lineHeight: '1.6',
              width: '100%'
            }}>
              {/* Text will be replaced by explosion animation */}
            </h2>
        </div>
      )}
      
      {/* Particle system renders in 3D scene */}
    </div>
  )
}

export default ExplodingTextToBirds