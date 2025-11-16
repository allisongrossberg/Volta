import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

// Ensure GSAP properly handles CSS variables in Safari
gsap.config({ 
  force3D: true,
  nullTargetWarn: false 
})

interface ButtonToBirdThreeJSProps {
  buttonElement: HTMLElement | null
  onAnimationComplete: () => void
  onBirdsFormed: () => void
  hypothesis: string
}

export default function ButtonToBirdThreeJS({ 
  buttonElement, 
  onAnimationComplete, 
  onBirdsFormed
}: ButtonToBirdThreeJSProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const birdMeshRef = useRef<THREE.Mesh | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animationStartedRef = useRef(false)
  const boidRef = useRef<any>(null)
  const waypointsRef = useRef<THREE.Vector3[]>([])
  const currentWaypointRef = useRef(0)
  const threeJsActiveRef = useRef(false)
  const createLoopWaypointsRef = useRef<((startX: number, startY: number) => THREE.Vector3[]) | null>(null)
  const animateThreeJSRef = useRef<(() => void) | null>(null)
  const hasLoggedRenderRef = useRef(false)
  const earlyCallbackTriggeredRef = useRef(false)
  const [buttonTextVisible, setButtonTextVisible] = useState(true)
  const [buttonPosition, setButtonPosition] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // First, set button position so container can render
  useEffect(() => {
    if (!buttonElement) {
      console.log('⚠️ ButtonToBirdThreeJS: Waiting for button element...')
      return
    }
    
    if (buttonPosition) {
      return // Already set
    }
    
    console.log('📐 ButtonToBirdThreeJS: Getting button position', buttonElement)
    const buttonRect = buttonElement.getBoundingClientRect()
    setButtonPosition({
      left: buttonRect.left,
      top: buttonRect.top,
      width: buttonRect.width,
      height: buttonRect.height
    })
    console.log('✅ Button position set:', buttonRect)
  }, [buttonElement, buttonPosition])

  // Then initialize Three.js once container is rendered
  useEffect(() => {
    // Don't re-initialize if animation is complete
    if (animationStartedRef.current && !threeJsActiveRef.current && waypointsRef.current.length > 0 && currentWaypointRef.current >= waypointsRef.current.length) {
      return // Animation complete, don't re-initialize
    }
    
    if (animationStartedRef.current) {
      // Only log once to reduce noise
      return
    }
    
    if (!buttonElement) {
      // Only log once to reduce noise
      if (!animationStartedRef.current) {
        console.log('⚠️ ButtonToBirdThreeJS: No button element yet')
      }
      return
    }
    
    if (!buttonPosition) {
      // Only log once to reduce noise
      if (!animationStartedRef.current) {
        console.log('⚠️ ButtonToBirdThreeJS: Waiting for button position...')
      }
      return
    }
    
    if (!containerRef.current) {
      console.warn('⚠️ ButtonToBirdThreeJS: Container ref not ready, will retry')
      // Use GSAP's delayedCall for consistent timing across browsers
      const retryDelayed = gsap.delayedCall(0.05, () => {
        if (containerRef.current && buttonElement && buttonPosition) {
          console.log('✅ ButtonToBirdThreeJS: Container ready on retry')
          // Force re-render by updating state or trigger effect again
        }
      })
      return () => retryDelayed.kill()
    }

    console.log('🎬 ButtonToBirdThreeJS: Starting animation', {
      hasButton: !!buttonElement,
      hasContainer: !!containerRef.current,
      buttonPosition
    })

    // Initialize Three.js
    // Use full viewport for container so bird can fly around entire screen
    const container = containerRef.current
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const width = viewportWidth
    const height = viewportHeight

    console.log('🎨 Initializing Three.js scene', { width, height, viewportWidth, viewportHeight })

    // Scene
    const scene = new THREE.Scene()
    scene.background = null // Transparent
    sceneRef.current = scene

    // Camera - use OrthographicCamera like HTML (EXACT from button-to-bird.html)
    const camera = new THREE.OrthographicCamera(
      width / -2, width / 2,
      height / 2, height / -2,
      1, 1000
    )
    camera.position.z = 450
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0) // Transparent
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.pointerEvents = 'none'
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    console.log('✅ Three.js initialized', {
      sceneChildren: scene.children.length,
      rendererSize: `${width}x${height}`
    })

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Create bird geometry (MATCH loading animation from ExplodingTextToBirds)
    function createBirdGeometry() {
      const geometry = new THREE.BufferGeometry()
      
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
      
      const indices = new Uint16Array([
        0, 1, 2,  // Nose to bottom back
        0, 1, 4,  // Nose to left wing
        0, 2, 5,  // Nose to right wing
        0, 3, 4,  // Nose to top left wing
        0, 3, 5,  // Nose to top right wing
        1, 3, 4,  // Left side
        2, 3, 5,  // Right side
      ])
      
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      geometry.computeVertexNormals()
      
      return geometry
    }
    
    const birdGeometry = createBirdGeometry()

    // For OrthographicCamera, coordinates are already in world space
    // No conversion needed - button position will be used directly
    
    // Create bird mesh (MATCH loading animation from ExplodingTextToBirds)
    const birdMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xDDC57A, // Golden tan to match button
      shininess: 20,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide
    })
    const bird = new THREE.Mesh(birdGeometry, birdMaterial)
    // Scale adjusted for OrthographicCamera - loading uses 1.2 with PerspectiveCamera
    bird.scale.set(3, 3, 3)
    ;(bird as any).phase = 0
    scene.add(bird)
    birdMeshRef.current = bird
    
    // Create Boid class (EXACT from HTML reference)
    class Boid {
      position: THREE.Vector3
      velocity: THREE.Vector3
      private _acceleration: THREE.Vector3
      private _width = 900
      private _height = 900
      private _depth = 1600
      private _goal: THREE.Vector3 | null = null
      private _neighborhoodRadius = 800
      private _maxSpeed = 3 // Increased speed for faster animation
      private _maxSteerForce = 0.1
      private _avoidWalls = false
      private vector = new THREE.Vector3()
      
      constructor() {
        this.position = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this._acceleration = new THREE.Vector3()
      }
      
      setGoal(target: THREE.Vector3) {
        this._goal = target
      }
      
      setAvoidWalls(value: boolean) {
        this._avoidWalls = value
      }
      
      setWorldSize(width: number, height: number, depth: number) {
        this._width = width
        this._height = height
        this._depth = depth
      }
      
      run(boids: Boid[]) {
        if (this._avoidWalls) {
          this.vector.set(-this._width, this.position.y, this.position.z)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(19)
          this._acceleration.add(this.vector)
          
          this.vector.set(this._width, this.position.y, this.position.z)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(19)
          this._acceleration.add(this.vector)
          
          this.vector.set(this.position.x, -this._height, this.position.z)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(19)
          this._acceleration.add(this.vector)
          
          this.vector.set(this.position.x, this._height, this.position.z)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(19)
          this._acceleration.add(this.vector)
          
          this.vector.set(this.position.x, this.position.y, -this._depth)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(15)
          this._acceleration.add(this.vector)
          
          this.vector.set(this.position.x, this.position.y, this._depth)
          this.vector = this.avoid(this.vector)
          this.vector.multiplyScalar(5)
          this._acceleration.add(this.vector)
        }
        
        if (Math.random() > 0.5) {
          this.flock(boids)
        }
        
        this.move()
      }
      
      flock(boids: Boid[]) {
        if (this._goal) {
          this._acceleration.add(this.reach(this._goal, 0.9))
        }
        
        this._acceleration.add(this.alignment(boids))
        this._acceleration.add(this.cohesion(boids))
        this._acceleration.add(this.separation(boids))
      }
      
      move() {
        this.velocity.add(this._acceleration)
        const l = this.velocity.length()
        if (l > this._maxSpeed) {
          this.velocity.divideScalar(l / this._maxSpeed)
        }
        this.position.add(this.velocity)
        this._acceleration.set(0, 0, 0)
      }
      
      checkBounds() {
        if (this.position.x > this._width) this.position.x = -this._width
        if (this.position.x < -this._width) this.position.x = this._width
        if (this.position.y > this._height) this.position.y = -this._height
        if (this.position.y < -this._height) this.position.y = this._height
        if (this.position.z > this._depth) this.position.z = -this._depth
        if (this.position.z < -this._depth) this.position.z = this._depth
      }
      
      avoid(target: THREE.Vector3): THREE.Vector3 {
        const steer = new THREE.Vector3()
        steer.copy(this.position)
        steer.sub(target)
        steer.multiplyScalar(1 / this.position.distanceToSquared(target))
        return steer
      }
      
      repulse(target: THREE.Vector3) {
        const distance = this.position.distanceTo(target)
        if (distance < 200) {
          const steer = new THREE.Vector3()
          steer.subVectors(this.position, target)
          steer.multiplyScalar(0.9 / distance)
          this._acceleration.add(steer)
        }
      }
      
      reach(target: THREE.Vector3, amount: number): THREE.Vector3 {
        const steer = new THREE.Vector3()
        steer.subVectors(target, this.position)
        steer.multiplyScalar(amount)
        return steer
      }
      
      alignment(boids: Boid[]): THREE.Vector3 {
        const velSum = new THREE.Vector3()
        let count = 0
        
        for (let i = 0; i < boids.length; i++) {
          if (Math.random() > 0.5) continue
          
          const boid = boids[i]
          const distance = boid.position.distanceTo(this.position)
          
          if (distance > 0 && distance <= this._neighborhoodRadius) {
            velSum.add(boid.velocity)
            count++
          }
        }
        
        if (count > 0) {
          velSum.divideScalar(count)
          const l = velSum.length()
          if (l > this._maxSteerForce) {
            velSum.divideScalar(l / this._maxSteerForce)
          }
        }
        
        return velSum
      }
      
      cohesion(boids: Boid[]): THREE.Vector3 {
        const posSum = new THREE.Vector3()
        const steer = new THREE.Vector3()
        let count = 0
        
        for (let i = 0; i < boids.length; i++) {
          if (Math.random() > 0.5) continue
          
          const boid = boids[i]
          const distance = boid.position.distanceTo(this.position)
          
          if (distance > 0 && distance <= this._neighborhoodRadius) {
            posSum.add(boid.position)
            count++
          }
        }
        
        if (count > 0) {
          posSum.divideScalar(count)
        }
        
        steer.subVectors(posSum, this.position)
        const l = steer.length()
        if (l > this._maxSteerForce) {
          steer.divideScalar(l / this._maxSteerForce)
        }
        
        return steer
      }
      
      separation(boids: Boid[]): THREE.Vector3 {
        const posSum = new THREE.Vector3()
        const repulse = new THREE.Vector3()
        
        for (let i = 0; i < boids.length; i++) {
          if (Math.random() > 0.2) continue
          
          const boid = boids[i]
          const distance = boid.position.distanceTo(this.position)
          
          if (distance > 0 && distance <= this._neighborhoodRadius) {
            repulse.subVectors(this.position, boid.position)
            repulse.normalize()
            repulse.divideScalar(distance)
            posSum.add(repulse)
          }
        }
        
        return posSum
      }
    }
    
    const boid = new Boid()
    boidRef.current = boid
    
    // Create waypoints function - bird flies completely off screen
    const createLoopWaypoints = (startX: number, startY: number) => {
      const points: THREE.Vector3[] = []
      const numPoints = 15 // Reduced points for faster exit
      const loopRadius = 100
      
      // Get viewport bounds for OrthographicCamera
      // Camera sees from -width/2 to width/2 and -height/2 to height/2
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const cameraRight = viewportWidth / 2
      const cameraLeft = -viewportWidth / 2
      const cameraTop = viewportHeight / 2
      const cameraBottom = -viewportHeight / 2
      
      // CRITICAL: Define safe boundaries to keep bird in viewport (not over header/nav)
      // In OrthographicCamera coordinates: Y=0 is center, positive Y is UP
      // Top edge is at viewportHeight/2, but we need margin for header
      const headerHeightPx = 80 // Adjust this based on your header/nav height
      const maxY = cameraTop - headerHeightPx // Stay below header
      
      console.log('Start position:', startX, startY, 'Viewport bounds:', { cameraLeft, cameraRight, cameraTop, cameraBottom })
      console.log('Y boundaries - Max (stay below header):', maxY, 'Min (bottom):', cameraBottom)
      
      // Create path: fly UP (within bounds), loop-de-loop, exit bottom right COMPLETELY off screen
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints
        let x: number, y: number
        
        if (t < 0.3) {
          // Fly UPWARD - but clamp to maxY to avoid header
          const t1 = t / 0.3
          x = startX + t1 * 80
          // Instead of flying fixed 200px up, calculate safe distance
          const targetY = startY + 200
          y = Math.min(targetY * t1 + startY * (1 - t1), maxY - loopRadius) // Stay below maxY with margin
        } else if (t < 0.7) {
          // Complete the loop-de-loop (clamped to safe area)
          const t2 = (t - 0.3) / 0.4
          const angle = t2 * Math.PI * 2
          const loopCenterX = startX + 150
          // Clamp loop center to ensure full loop stays below header
          const desiredLoopY = startY + 200
          const loopCenterY = Math.min(desiredLoopY, maxY - loopRadius)
          x = loopCenterX + Math.sin(angle) * loopRadius
          y = loopCenterY - Math.cos(angle) * loopRadius
        } else {
          // Exit toward bottom right - ensure it goes COMPLETELY off screen (no clamping on exit)
          const t3 = (t - 0.7) / 0.3
          // Start from loop end position, fly far beyond viewport bounds
          const exitStartX = startX + 250
          const exitStartY = startY + 100
          // Final position should be well beyond the right edge and bottom edge
          const finalX = cameraRight + 600 // Well beyond right edge
          const finalY = cameraBottom - 400 // Well beyond bottom edge
          x = exitStartX + t3 * (finalX - exitStartX)
          y = exitStartY + t3 * (finalY - exitStartY)
        }
        
        if (i < 5 || i > numPoints - 3) console.log('Waypoint', i, ':', x, y, 'maxY:', maxY, 'offScreen:', x > cameraRight || y < cameraBottom)
        points.push(new THREE.Vector3(x, y, 0))
      }
      
      console.log('✅ Created', points.length, 'waypoints - final waypoint:', points[points.length - 1], 'should be off screen')
      return points
    }
    createLoopWaypointsRef.current = createLoopWaypoints
    
    // Animation function (EXACT from button-to-bird.html)
    const animateThreeJS = () => {
      if (!threeJsActiveRef.current) return
      
      animationFrameRef.current = requestAnimationFrame(animateThreeJS)
      
      const boid = boidRef.current
      const bird = birdMeshRef.current
      const waypoints = waypointsRef.current
      const currentWaypoint = currentWaypointRef.current
      
      if (!boid || !bird || !rendererRef.current || !cameraRef.current || !sceneRef.current) return
      
      // Use boid physics to smoothly move toward next waypoint
      if (currentWaypoint < waypoints.length) {
        const target = waypoints[currentWaypoint]
        boid.setGoal(target)
        // Use run() method with empty boids array (single bird, no flocking)
        boid.run([])
        
        bird.position.copy(boid.position)
        
        // Move to next waypoint when close enough - larger threshold for faster progression
        if (boid.position.distanceTo(target) < 50) {
          currentWaypointRef.current++
        }
        
        // Calculate rotation based on velocity (matching HTML reference)
        const velLength = boid.velocity.length()
        if (velLength > 0) {
          bird.rotation.y = Math.atan2(-boid.velocity.z, boid.velocity.x)
          bird.rotation.z = Math.asin(boid.velocity.y / velLength)
        }
        
        // Wing flapping - Match boid bird animation (simple consistent speed)
        const birdAny = bird as any
        if (birdAny.phase === undefined) birdAny.phase = 0
        birdAny.phase += 0.3 // Consistent increment like loading screen boids
        const flapAmount = Math.sin(birdAny.phase) * 5
        // Update wing vertices (indices 4 and 5 in the geometry)
        if (bird.geometry.attributes.position && bird.geometry.attributes.position.array) {
          const positions = bird.geometry.attributes.position.array as Float32Array
          if (positions.length > 16) {
            positions[13] = flapAmount // vertex 4 y
            positions[16] = flapAmount // vertex 5 y
            bird.geometry.attributes.position.needsUpdate = true
          }
        }
      } else {
        // Animation complete
        threeJsActiveRef.current = false
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        
        console.log('✅ Three.js bird animation complete')
        
        // Call completion callbacks immediately - no delays
        if (onAnimationComplete) {
          onAnimationComplete()
        }
        // Call onBirdsFormed immediately when animation actually completes
        if (onBirdsFormed) {
          onBirdsFormed()
        }
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
    animateThreeJSRef.current = animateThreeJS
    
    console.log('✅ Three.js scene ready for bird animation')

    animationStartedRef.current = true

    // Step 1: Start CSS morph IMMEDIATELY
    console.log('🎬 Step 1: Starting CSS morph - button will fold into triangle')
    setButtonTextVisible(false)
    
    if (!buttonElement) {
      console.error('❌ No button element for CSS morphing')
      return
    }
    
    // RESET ALL CSS VARIABLES to initial button state before animation
    console.log('🔄 Resetting button to initial state before animation')
    
    // Ensure button is fully visible
    buttonElement.style.opacity = '1'
    buttonElement.style.visibility = 'visible'
    buttonElement.style.display = 'inline-block'
    
    // Reset animation CSS variables
    buttonElement.style.setProperty('--plane-opacity', '1')
    buttonElement.style.setProperty('--text-opacity', '1')
    buttonElement.style.setProperty('--border-radius', '7')
    buttonElement.style.setProperty('--rotate', '0')
    buttonElement.style.setProperty('--plane-x', '0')
    buttonElement.style.setProperty('--plane-y', '0')
    
    // Reset background colors to ensure shapes are visible
    buttonElement.style.setProperty('--left-wing-background', '#DDC57A')
    buttonElement.style.setProperty('--right-wing-background', '#DDC57A')
    buttonElement.style.setProperty('--left-body-background', '#DDC57A')
    buttonElement.style.setProperty('--right-body-background', '#DDC57A')
    
    // Reset wing positions to rectangle (initial button state from HTML)
    buttonElement.style.setProperty('--left-wing-first-x', '0')
    buttonElement.style.setProperty('--left-wing-first-y', '0')
    buttonElement.style.setProperty('--left-wing-second-x', '50')
    buttonElement.style.setProperty('--left-wing-second-y', '0')
    buttonElement.style.setProperty('--left-wing-third-x', '0')
    buttonElement.style.setProperty('--left-wing-third-y', '100')
    buttonElement.style.setProperty('--right-wing-first-x', '50')
    buttonElement.style.setProperty('--right-wing-first-y', '0')
    buttonElement.style.setProperty('--right-wing-second-x', '100')
    buttonElement.style.setProperty('--right-wing-second-y', '0')
    buttonElement.style.setProperty('--right-wing-third-x', '100')
    buttonElement.style.setProperty('--right-wing-third-y', '100')
    // Reset body positions
    buttonElement.style.setProperty('--left-body-first-x', '50')
    buttonElement.style.setProperty('--left-body-first-y', '0')
    buttonElement.style.setProperty('--left-body-second-x', '50')
    buttonElement.style.setProperty('--left-body-second-y', '100')
    buttonElement.style.setProperty('--left-body-third-x', '0')
    buttonElement.style.setProperty('--left-body-third-y', '100')
    buttonElement.style.setProperty('--right-body-first-x', '50')
    buttonElement.style.setProperty('--right-body-first-y', '0')
    buttonElement.style.setProperty('--right-body-second-x', '50')
    buttonElement.style.setProperty('--right-body-second-y', '100')
    buttonElement.style.setProperty('--right-body-third-x', '100')
    buttonElement.style.setProperty('--right-body-third-y', '100')
    
    // Force a reflow to ensure CSS is applied
    void buttonElement.offsetWidth
    
    // Button should now be visible and in initial state
    console.log('👁️ Button reset and ready for animation:', {
      hasActiveClass: buttonElement.classList.contains('active'),
      computedOpacity: window.getComputedStyle(buttonElement).opacity,
      computedVisibility: window.getComputedStyle(buttonElement).visibility,
      computedPosition: window.getComputedStyle(buttonElement).position,
      planeOpacity: buttonElement.style.getPropertyValue('--plane-opacity'),
      borderRadius: buttonElement.style.getPropertyValue('--border-radius'),
      leftWingBg: buttonElement.style.getPropertyValue('--left-wing-background'),
      hasLeftDiv: !!buttonElement.querySelector('.left'),
      hasRightDiv: !!buttonElement.querySelector('.right')
    })
    
    // Get CSS variable helper (from HTML code)
    const getVar = (variable: string) => {
      return getComputedStyle(buttonElement).getPropertyValue(variable)
    }
    
    // Execute the HTML's JavaScript code directly on the button
    // This is the EXACT code from button-to-bird.html that should run
    // In HTML, it runs on click, but here we trigger it programmatically after 'active' is set
    const executeHTMLAnimation = () => {
      if (!buttonElement) return
      
      // The button already has 'active' class (set in AnimationPage.tsx)
      // So we skip the HTML's check and run the animation directly
      console.log('🎯 Running HTML animation code on button:', {
        element: buttonElement.tagName,
        classes: buttonElement.className,
        hasActiveClass: buttonElement.classList.contains('active'),
        visible: buttonElement.offsetWidth > 0 && buttonElement.offsetHeight > 0,
        rect: buttonElement.getBoundingClientRect(),
        leftDiv: buttonElement.querySelector('.left'),
        rightDiv: buttonElement.querySelector('.right')
      })
      
      // Helper function to force Safari to repaint (fixes clip-path animation issues)
      const forceSafariRepaint = () => {
        if (buttonElement) {
          // Force a reflow in Safari by reading offsetHeight
          void buttonElement.offsetHeight
          // Force repaint by toggling a transform
          const currentTransform = buttonElement.style.transform
          buttonElement.style.transform = 'translateZ(0.001px)'
          void buttonElement.offsetHeight
          buttonElement.style.transform = currentTransform
        }
      }
      
      // EXACT animation from button-to-bird.html
      // Fold into BIRD shape (matching boid geometry - two triangular wings)
      // Use explicit timeline for better cross-browser timing control
      const morphTimeline = gsap.timeline()
      
      morphTimeline.to(buttonElement, {
        // Collapse to horizontal line
        '--left-wing-first-x': 0,
        '--left-wing-first-y': 50,
        '--left-wing-second-x': 50,
        '--left-wing-second-y': 50,
        '--left-wing-third-x': 0,
        '--left-wing-third-y': 50,
        '--right-wing-first-x': 50,
        '--right-wing-first-y': 50,
        '--right-wing-second-x': 100,
        '--right-wing-second-y': 50,
        '--right-wing-third-x': 100,
        '--right-wing-third-y': 50,
        '--border-radius': 0,
        duration: 0.2,
        ease: 'power2.inOut',
        onUpdate: forceSafariRepaint,
        force3D: true
      }).to(buttonElement, {
        // Form bird wings (wider like boid)
        '--left-wing-first-x': 50,
        '--left-wing-first-y': 50,
        '--left-wing-second-x': 0,
        '--left-wing-second-y': 55,
        '--left-wing-third-x': 50,
        '--left-wing-third-y': 70,
        '--right-wing-first-x': 50,
        '--right-wing-first-y': 50,
        '--right-wing-second-x': 100,
        '--right-wing-second-y': 55,
        '--right-wing-third-x': 50,
        '--right-wing-third-y': 70,
        '--left-body-first-x': 50,
        '--left-body-first-y': 50,
        '--left-body-second-x': 50,
        '--left-body-second-y': 50,
        '--left-body-third-x': 50,
        '--left-body-third-y': 50,
        '--right-body-first-x': 50,
        '--right-body-first-y': 50,
        '--right-body-second-x': 50,
        '--right-body-second-y': 50,
        '--right-body-third-x': 50,
        '--right-body-third-y': 50,
        duration: 0.3,
        ease: 'power2.inOut',
        onUpdate: forceSafariRepaint,
        force3D: true
      })
      
      // Wing flapping before takeoff (EXACT from HTML)
      const flapTimeline = gsap.timeline({ delay: 0 }) // No delay - start immediately
      
      // Flap 3 times
      for (let i = 0; i < 3; i++) {
        flapTimeline.to(buttonElement, {
          '--left-wing-third-y': 55,
          '--right-wing-third-y': 55,
          duration: 0.15,
          onUpdate: forceSafariRepaint,
          force3D: true
        }).to(buttonElement, {
          '--left-wing-third-y': 70,
          '--right-wing-third-y': 70,
          duration: 0.15,
          onUpdate: forceSafariRepaint,
          force3D: true
        })
      }
      
      // After flapping, transition to Three.js (EXACT from button-to-bird.html)
      flapTimeline.to(buttonElement, {
        '--plane-opacity': 0,
        duration: 0.2,
        onUpdate: forceSafariRepaint,
        force3D: true,
        onComplete() {
          console.log('✅ CSS bird flew offscreen - starting Three.js bird animation')
          
          // Hide button completely
          if (buttonElement) {
            buttonElement.style.opacity = '0'
            buttonElement.style.visibility = 'hidden'
            buttonElement.style.pointerEvents = 'none'
            buttonElement.style.display = 'none'
          }
          
          // Start Three.js bird with physics (EXACT from button-to-bird.html)
          if (buttonElement && buttonPosition && boidRef.current && birdMeshRef.current && createLoopWaypointsRef.current && animateThreeJSRef.current) {
            const buttonRect = buttonElement.getBoundingClientRect()
            const buttonCenterX = buttonRect.left + buttonRect.width / 2 - window.innerWidth / 2
            const buttonCenterY = -(buttonRect.top + buttonRect.height / 2 - window.innerHeight / 2)
            
            // Set boid starting position
            boidRef.current.position.set(buttonCenterX, buttonCenterY, 0)
            boidRef.current.velocity.set(0.5, -0.5, 0)
            
            // Create waypoints
            const waypoints = createLoopWaypointsRef.current(buttonCenterX, buttonCenterY)
            waypointsRef.current = waypoints
            currentWaypointRef.current = 0
            earlyCallbackTriggeredRef.current = false // Reset early callback flag
            
            // Ensure bird is visible and positioned correctly
            if (birdMeshRef.current) {
              birdMeshRef.current.position.copy(boidRef.current.position)
              birdMeshRef.current.visible = true
              console.log('👁️ Bird mesh made visible at position:', birdMeshRef.current.position)
            }
            
            // Ensure scene has the bird
            if (sceneRef.current && birdMeshRef.current && !sceneRef.current.children.includes(birdMeshRef.current)) {
              sceneRef.current.add(birdMeshRef.current)
              console.log('➕ Added bird to scene')
            }
            
            // Use GSAP's delayedCall instead of setTimeout for consistent cross-browser timing
            // This syncs with GSAP's ticker which is more reliable across browsers
            gsap.delayedCall(0.05, () => {
              threeJsActiveRef.current = true
              if (animateThreeJSRef.current) {
                animateThreeJSRef.current()
              }
              
              console.log('🐦 Three.js bird animation started', {
                startPos: { x: buttonCenterX, y: buttonCenterY },
                waypointsCount: waypoints.length,
                birdVisible: birdMeshRef.current?.visible,
                birdInScene: sceneRef.current?.children.includes(birdMeshRef.current || {} as THREE.Mesh)
              })
            })
          } else {
            console.error('❌ Cannot start Three.js bird - missing refs', {
              hasButton: !!buttonElement,
              hasPosition: !!buttonPosition,
              hasBoid: !!boidRef.current,
              hasBird: !!birdMeshRef.current,
              hasCreateWaypoints: !!createLoopWaypointsRef.current,
              hasAnimate: !!animateThreeJSRef.current
            })
          }
        }
      })
      
      // Color changes (EXACT from HTML)
      gsap.to(buttonElement, {
        keyframes: [{
          '--text-opacity': 0,
          '--border-radius': 0,
          '--left-wing-background': getVar('--primary-darkest'),
          '--right-wing-background': getVar('--primary-darkest'),
          duration: 0.1,
          onUpdate: forceSafariRepaint,
          force3D: true
        }, {
          '--left-wing-background': getVar('--primary'),
          '--right-wing-background': getVar('--primary'),
          duration: 0.1,
          onUpdate: forceSafariRepaint,
          force3D: true
        }, {
          '--left-body-background': getVar('--primary-dark'),
          '--right-body-background': getVar('--primary-darkest'),
          duration: 0.4,
          onUpdate: forceSafariRepaint,
          force3D: true
        }]
        // Removed the "sent" success message animation
      })
    }
    
    // Use GSAP's delayedCall for more reliable cross-browser timing
    // This ensures proper initialization without race conditions
    gsap.delayedCall(0.016, () => {
      // 16ms = 1 frame at 60fps, ensures CSS is applied and browser has painted
      executeHTMLAnimation()
    })

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (rendererRef.current && containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
      }
      if (sceneRef.current) {
        sceneRef.current.clear()
      }
    }
  }, [buttonElement, buttonPosition, onAnimationComplete, onBirdsFormed])

  // Debug: Log when component renders (only log once to reduce noise)
  useEffect(() => {
    if (!hasLoggedRenderRef.current) {
      console.log('🔄 ButtonToBirdThreeJS component rendered', {
        hasButtonElement: !!buttonElement,
        hasButtonPosition: !!buttonPosition
      })
      hasLoggedRenderRef.current = true
    }
  })

  // Render container covering full viewport so bird can fly around
  const containerStyle = {
    position: 'fixed' as const,
    left: '0px',
    top: '0px',
    width: '100vw',
    height: '100vh',
    zIndex: 99999,
    pointerEvents: 'none' as const,
    isolation: 'isolate' as const
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
    >
      {/* Button text overlay - hide when bird appears */}
      {buttonTextVisible && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            textAlign: 'left',
            fontSize: '0.75rem',
            fontFamily: 'Crimson Text, serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            color: '#000000',
            opacity: buttonTextVisible ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          Transform
        </div>
      )}
    </div>
  )
}

