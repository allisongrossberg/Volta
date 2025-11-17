import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

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
    
    // CRITICAL: Lock button position with !important to prevent any movement
    // Override any CSS transforms that might move the button
    buttonElement.style.setProperty('position', 'fixed', 'important')
    buttonElement.style.setProperty('left', `${buttonRect.left}px`, 'important')
    buttonElement.style.setProperty('top', `${buttonRect.top}px`, 'important')
    buttonElement.style.setProperty('width', `${buttonRect.width}px`, 'important')
    buttonElement.style.setProperty('height', `${buttonRect.height}px`, 'important')
    buttonElement.style.setProperty('margin', '0', 'important')
    buttonElement.style.setProperty('padding', '8px 24px', 'important')
    buttonElement.style.setProperty('transform', 'none', 'important')
    buttonElement.style.setProperty('will-change', 'opacity', 'important')
    buttonElement.style.setProperty('--rotate', '0', 'important')
    buttonElement.style.setProperty('--plane-x', '0', 'important')
    buttonElement.style.setProperty('--plane-y', '0', 'important')
    void buttonElement.offsetWidth // Force reflow to lock position immediately
    
    setButtonPosition({
      left: buttonRect.left,
      top: buttonRect.top,
      width: buttonRect.width,
      height: buttonRect.height
    })
    console.log('✅ Button position set and locked:', buttonRect)
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
      // Retry after a short delay
      setTimeout(() => {
        if (containerRef.current && buttonElement && buttonPosition) {
          console.log('✅ ButtonToBirdThreeJS: Container ready on retry')
          // Force re-render by updating state or trigger effect again
        }
      }, 50)
      return
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
    bird.visible = false // Hidden until animation starts
    scene.add(bird)
    birdMeshRef.current = bird
    console.log('✅ Bird created and added to scene (initially hidden)')
    
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
      private _maxSpeed = 3 // Slower speed for more graceful flight
      private _maxSteerForce = 0.15 // Faster steering for quicker turns
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
      const numPoints = 10 // Fewer points for much faster exit
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
          // Fly UPWARD from button position - explode upward
          const t1 = t / 0.3
          x = startX + t1 * 80 // Slight rightward movement
          // Fly upward significantly to create "explosion" effect
          const targetY = startY + 250 // Fly 250px upward
          y = Math.min(targetY * t1 + startY * (1 - t1), maxY - loopRadius) // Stay below maxY with margin
        } else if (t < 0.7) {
          // Complete the loop-de-loop (clamped to safe area)
          const t2 = (t - 0.3) / 0.4
          const angle = t2 * Math.PI * 2
          const loopCenterX = startX + 150
          // Clamp loop center to ensure full loop stays below header
          const desiredLoopY = startY + 250 // Match the upward explosion distance
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
      if (!threeJsActiveRef.current) {
        console.log('⏸️ Animation stopped - threeJsActiveRef is false')
        return
      }
      
      animationFrameRef.current = requestAnimationFrame(animateThreeJS)
      
      const boid = boidRef.current
      const bird = birdMeshRef.current
      const waypoints = waypointsRef.current
      const currentWaypoint = currentWaypointRef.current
      
      if (!boid || !bird || !rendererRef.current || !cameraRef.current || !sceneRef.current) {
        console.log('⏸️ Animation stopped - missing refs', {
          hasBoid: !!boid,
          hasBird: !!bird,
          hasRenderer: !!rendererRef.current,
          hasCamera: !!cameraRef.current,
          hasScene: !!sceneRef.current
        })
        return
      }
      
      // Use boid physics to smoothly move toward next waypoint
      if (currentWaypoint < waypoints.length) {
        const target = waypoints[currentWaypoint]
        boid.setGoal(target)
        // Use run() method with empty boids array (single bird, no flocking)
        boid.run([])
        
        bird.position.copy(boid.position)
        
        // Move to next waypoint when close enough - smaller threshold for slower, more precise movement
        const distance = boid.position.distanceTo(target)
        if (distance < 50) { // Smaller threshold for slower, more deliberate movement
          currentWaypointRef.current++
          if (currentWaypointRef.current % 5 === 0) {
            console.log(`📍 Reached waypoint ${currentWaypointRef.current}/${waypoints.length}, distance: ${distance.toFixed(2)}`)
          }
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
        
        console.log('✅ Three.js bird animation complete - bird has flown offscreen')
        
        // Call onBirdsFormed when animation completes (bird has flown away)
        if (onBirdsFormed) {
          console.log('🐦 Calling onBirdsFormed - button bird animation complete')
          onBirdsFormed()
        }
        
        // Call completion callback
        if (onAnimationComplete) {
          onAnimationComplete()
        }
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
    animateThreeJSRef.current = animateThreeJS
    
    console.log('✅ Three.js scene ready for bird animation')

    animationStartedRef.current = true

    // NO CSS MORPHING - Button will transform directly into bird
    console.log('🔄 Button will transform directly into bird - smooth fade and scale')
    setButtonTextVisible(false)
    
    if (!buttonElement) {
      console.error('❌ No button element for transformation')
      return
    }
    
    // Execute the transformation animation directly - no morphing/folding
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
      
      // Updated animation: Button fades out as bird appears and flies away
      // Start bird immediately, fade button simultaneously
      console.log('🔍 Checking refs for animation:', {
        hasButtonElement: !!buttonElement,
        hasButtonPosition: !!buttonPosition,
        hasBoid: !!boidRef.current,
        hasBirdMesh: !!birdMeshRef.current,
        hasCreateLoopWaypoints: !!createLoopWaypointsRef.current,
        hasAnimateThreeJS: !!animateThreeJSRef.current
      })
      
      if (buttonElement && buttonPosition && boidRef.current && birdMeshRef.current && createLoopWaypointsRef.current && animateThreeJSRef.current) {
        // Use the locked buttonPosition instead of recalculating - this ensures bird starts exactly where button is
        const buttonCenterX = buttonPosition.left + buttonPosition.width / 2 - window.innerWidth / 2
        const buttonCenterY = -(buttonPosition.top + buttonPosition.height / 2 - window.innerHeight / 2)
        
        console.log('📍 Bird starting position (from locked button position):', {
          buttonPosition,
          buttonCenterX,
          buttonCenterY,
          windowSize: { width: window.innerWidth, height: window.innerHeight }
        })
        
        // Position bird at button location (exact center of button)
        boidRef.current.position.set(buttonCenterX, buttonCenterY, 0)
        if (birdMeshRef.current) {
          birdMeshRef.current.position.copy(boidRef.current.position)
        }
        
        // CRITICAL: Lock button position with !important BEFORE any animations
        // Use the locked buttonPosition to ensure it stays exactly where it was
        if (buttonElement && buttonPosition) {
          buttonElement.style.setProperty('position', 'fixed', 'important')
          buttonElement.style.setProperty('left', `${buttonPosition.left}px`, 'important')
          buttonElement.style.setProperty('top', `${buttonPosition.top}px`, 'important')
          buttonElement.style.setProperty('width', `${buttonPosition.width}px`, 'important')
          buttonElement.style.setProperty('height', `${buttonPosition.height}px`, 'important')
          buttonElement.style.setProperty('margin', '0', 'important')
          buttonElement.style.setProperty('padding', '8px 24px', 'important')
          buttonElement.style.setProperty('transform', 'none', 'important')
          buttonElement.style.setProperty('transform-origin', 'center center', 'important')
          buttonElement.style.setProperty('will-change', 'transform, opacity', 'important')
          buttonElement.style.setProperty('--rotate', '0', 'important')
          buttonElement.style.setProperty('--plane-x', '0', 'important')
          buttonElement.style.setProperty('--plane-y', '0', 'important')
          // Force reflow to ensure position is locked
          void buttonElement.offsetWidth
          
          console.log('🔒 Button position locked at:', {
            left: buttonPosition.left,
            top: buttonPosition.top,
            width: buttonPosition.width,
            height: buttonPosition.height
          })
        }
        
        // Ensure scene has the bird and make it visible
        if (sceneRef.current && birdMeshRef.current) {
          // Make sure bird is in the scene
          if (!sceneRef.current.children.includes(birdMeshRef.current)) {
            sceneRef.current.add(birdMeshRef.current)
            console.log('➕ Added bird to scene')
          }
          // Bird will be set to button size in the animation below
          // Ensure bird position is set
          birdMeshRef.current.position.copy(boidRef.current.position)
          console.log('👁️ Bird made visible and ready for animation', {
            position: birdMeshRef.current.position,
            visible: birdMeshRef.current.visible,
            inScene: sceneRef.current.children.includes(birdMeshRef.current),
            sceneChildren: sceneRef.current.children.length
          })
        } else {
          console.error('❌ Cannot start bird animation - missing scene or bird mesh', {
            hasScene: !!sceneRef.current,
            hasBird: !!birdMeshRef.current
          })
        }
        
        // CRITICAL: Ensure button is fully visible and ready before explosion
        if (buttonElement) {
          buttonElement.style.opacity = '1'
          buttonElement.style.visibility = 'visible'
          buttonElement.style.display = 'inline-block'
          // Force a reflow to ensure button is visible
          void buttonElement.offsetWidth
        }
        
        // CRITICAL: Morph button shape into bird shape using Three.js
        // Create a plane that starts as button rectangle and morphs to bird triangle
        const transformationDuration = 1.2 // 1200ms for smooth morphing transformation
        const pauseBeforeFlight = 2000 // 2000ms (2 seconds) pause after bird appears before flight starts
        const wingFlapStartDelay = 500 // Start wing flapping 500ms after morph completes
        
        // Calculate button size in Three.js world coordinates
        const buttonWidthWorld = (buttonPosition.width / window.innerWidth) * width
        const buttonHeightWorld = (buttonPosition.height / window.innerHeight) * height
        
        // Use the EXACT same bird geometry structure, but scale it to button size initially
        // This guarantees the morphed shape is identical to the bird
        const morphGeometry = createBirdGeometry() // Use the exact same geometry function
        
        // Calculate scale to make bird match button size initially
        // Bird base width is 4 units (from -2 to 2), at scale 1
        // We want it to match button width
        const birdBaseWidth = 4 // Bird spans from -2 to 2 = 4 units
        const initialScale = buttonWidthWorld / birdBaseWidth
        
        // Start with bird geometry scaled to button size
        // Store original bird vertices (at scale 1)
        const birdBaseVertices = new Float32Array([
          0, 0, 0,      // 0: nose
          -1, -1, 0,    // 1: bottom left back
          1, -1, 0,     // 2: bottom right back
          -1, 1, 0,     // 3: top left back
          -2, 0, 0,     // 4: left wing tip
          2, 0, 0,      // 5: right wing tip
        ])
        
        // Scale bird vertices to button size (initial state)
        const buttonScaledVertices = new Float32Array(birdBaseVertices.length)
        for (let i = 0; i < birdBaseVertices.length; i += 3) {
          buttonScaledVertices[i] = birdBaseVertices[i] * initialScale
          buttonScaledVertices[i + 1] = birdBaseVertices[i + 1] * initialScale
          buttonScaledVertices[i + 2] = birdBaseVertices[i + 2] * initialScale
        }
        
        // Final bird vertices at scale 3 (matching the actual bird mesh)
        const birdScale = 3
        const birdFinalVertices = new Float32Array([
          0, 0, 0,                          // 0: nose
          -1 * birdScale, -1 * birdScale, 0,  // 1: bottom left back
          1 * birdScale, -1 * birdScale, 0,   // 2: bottom right back
          -1 * birdScale, 1 * birdScale, 0,   // 3: top left back
          -2 * birdScale, 0, 0,               // 4: left wing tip
          2 * birdScale, 0, 0,                // 5: right wing tip
        ])
        
        // Set initial vertices to button-scaled bird shape
        morphGeometry.setAttribute('position', new THREE.BufferAttribute(buttonScaledVertices, 3))
        morphGeometry.computeVertexNormals()
        
        const morphMaterial = new THREE.MeshPhongMaterial({
          color: 0xDDC57A, // Match button color
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide
        })
        const morphMesh = new THREE.Mesh(morphGeometry, morphMaterial)
        morphMesh.position.set(buttonCenterX, buttonCenterY, 0)
        morphMesh.visible = true
        scene.add(morphMesh)
        
        // Store vertices for morphing
        const originalPositions = new Float32Array(buttonScaledVertices)
        const targetPositions = birdFinalVertices
        
        // Hide HTML button immediately and show morphing plane
        if (buttonElement && buttonPosition) {
          buttonElement.style.setProperty('opacity', '0', 'important')
          buttonElement.style.setProperty('visibility', 'hidden', 'important')
        }
        
        // Start rendering loop immediately to show the morphing plane
        const startRenderLoop = () => {
          const render = () => {
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
              rendererRef.current.render(sceneRef.current, cameraRef.current)
              requestAnimationFrame(render)
            }
          }
          render()
        }
        startRenderLoop()
        
        console.log('🔄 Starting button-to-bird morph:', {
          buttonSize: { width: buttonWidthWorld, height: buttonHeightWorld },
          birdScale: birdScale,
          position: { x: buttonCenterX, y: buttonCenterY }
        })
        
        const tl = gsap.timeline({ immediateRender: false })
        
        // Morph geometry from rectangle to bird triangle shape
        const morphProgress = { value: 0 }
        tl.to(morphProgress, {
          value: 1,
          duration: transformationDuration,
          ease: 'power2.out',
          onUpdate: () => {
            const t = morphProgress.value
            const positions = morphGeometry.attributes.position.array as Float32Array
            
            // Smoothly interpolate each vertex from rectangle to bird shape
            for (let i = 0; i < positions.length; i += 3) {
              const vertexIndex = i / 3
              const startX = originalPositions[i]
              const startY = originalPositions[i + 1]
              const startZ = originalPositions[i + 2]
              
              const targetX = targetPositions[vertexIndex * 3] || startX
              const targetY = targetPositions[vertexIndex * 3 + 1] || startY
              const targetZ = targetPositions[vertexIndex * 3 + 2] || startZ
              
              // Smooth interpolation
              positions[i] = startX + (targetX - startX) * t
              positions[i + 1] = startY + (targetY - startY) * t
              positions[i + 2] = startZ + (targetZ - startZ) * t
            }
            
            morphGeometry.attributes.position.needsUpdate = true
            morphGeometry.computeVertexNormals()
          },
          onComplete: () => {
            // After morphing completes, hide morphing plane and show actual bird
            morphMesh.visible = false
            scene.remove(morphMesh)
            
            // Show the actual bird mesh - it should already be at the exact same position and scale
            // as the morphed shape, so it should be a seamless transition
            if (birdMeshRef.current) {
              birdMeshRef.current.visible = true
              birdMeshRef.current.scale.set(3, 3, 3) // Same scale as morphed shape
              birdMeshRef.current.position.set(buttonCenterX, buttonCenterY, 0)
              birdMeshRef.current.rotation.set(0, 0, 0) // Ensure no rotation
              
              // Initialize bird phase for wing flapping
              ;(birdMeshRef.current as any).phase = 0
              
              // Start wing flapping animation after a short delay
              setTimeout(() => {
                if (birdMeshRef.current && sceneRef.current && rendererRef.current && cameraRef.current) {
                  // Wing flapping animation loop
                  const flapStartTime = Date.now()
                  const flapDuration = pauseBeforeFlight - wingFlapStartDelay // Flap for remaining pause time
                  
                  const flapAnimation = () => {
                    if (!birdMeshRef.current || !sceneRef.current) return
                    
                    const elapsed = (Date.now() - flapStartTime) / 1000 // Convert to seconds
                    if (elapsed < flapDuration / 1000) {
                      // Update wing flapping
                      const birdAny = birdMeshRef.current as any
                      if (birdAny.phase === undefined) birdAny.phase = 0
                      birdAny.phase += 0.3 // Consistent increment per frame
                      const flapAmount = Math.sin(birdAny.phase) * 5
                      
                      // Update wing vertices (indices 4 and 5 in the geometry)
                      if (birdMeshRef.current.geometry.attributes.position && birdMeshRef.current.geometry.attributes.position.array) {
                        const positions = birdMeshRef.current.geometry.attributes.position.array as Float32Array
                        if (positions.length > 16) {
                          positions[13] = flapAmount // vertex 4 y
                          positions[16] = flapAmount // vertex 5 y
                          birdMeshRef.current.geometry.attributes.position.needsUpdate = true
                        }
                      }
                      
                      // Render the scene
                      if (rendererRef.current && cameraRef.current) {
                        rendererRef.current.render(sceneRef.current, cameraRef.current)
                      }
                      
                      requestAnimationFrame(flapAnimation)
                    }
                  }
                  flapAnimation()
                }
              }, wingFlapStartDelay)
              
              // Make sure the bird geometry matches exactly
              console.log('🐦 Bird mesh shown after morph:', {
                position: birdMeshRef.current.position,
                scale: birdMeshRef.current.scale,
                rotation: birdMeshRef.current.rotation,
                visible: birdMeshRef.current.visible
              })
            }
            
            // Hide button completely
            if (buttonElement && buttonPosition) {
              buttonElement.style.setProperty('position', 'fixed', 'important')
              buttonElement.style.setProperty('left', `${buttonPosition.left}px`, 'important')
              buttonElement.style.setProperty('top', `${buttonPosition.top}px`, 'important')
              buttonElement.style.setProperty('transform', 'none', 'important')
              buttonElement.style.setProperty('opacity', '0', 'important')
              buttonElement.style.setProperty('visibility', 'hidden', 'important')
              buttonElement.style.setProperty('display', 'none', 'important')
              buttonElement.style.setProperty('pointer-events', 'none', 'important')
              buttonElement.classList.remove('active')
            }
          }
        }, 0)
        
        // Animate bird: start invisible, then appear after morph completes
        // (Bird will be shown in morph onComplete)
        tl.to({}, {
          duration: transformationDuration,
          onComplete: () => {
            // Pause after bird appears (with wing flapping), then start flight
            setTimeout(() => {
              // Start flight animation with slower initial velocity
              if (boidRef.current) {
                boidRef.current.velocity.set(0.3, -0.3, 0) // Slower speed (reduced from 0.5, -0.5)
              }
              
              const waypoints = createLoopWaypointsRef.current!(buttonCenterX, buttonCenterY)
              waypointsRef.current = waypoints
              currentWaypointRef.current = 0
              earlyCallbackTriggeredRef.current = false // Reset early callback flag
              
              if (birdMeshRef.current) {
                console.log('👁️ Bird mesh made visible at position:', birdMeshRef.current.position)
              }
              
              // Ensure button is completely hidden before starting flight
              // CRITICAL: Use setProperty with !important to override CSS .active class rules
              if (buttonElement && buttonPosition) {
                buttonElement.style.setProperty('position', 'fixed', 'important')
                buttonElement.style.setProperty('left', `${buttonPosition.left}px`, 'important')
                buttonElement.style.setProperty('top', `${buttonPosition.top}px`, 'important')
                buttonElement.style.setProperty('transform', 'none', 'important')
                buttonElement.style.setProperty('opacity', '0', 'important') // Override CSS .active opacity: 1 !important
                buttonElement.style.setProperty('visibility', 'hidden', 'important') // Override CSS .active visibility: visible !important
                buttonElement.style.setProperty('display', 'none', 'important') // Override CSS .active display: inline-block !important
                buttonElement.style.setProperty('pointer-events', 'none', 'important')
                // Remove active class to prevent CSS from re-showing the button
                buttonElement.classList.remove('active')
              }
              
              // Start animation immediately - no delay
              threeJsActiveRef.current = true
              if (animateThreeJSRef.current) {
                // Start the animation loop
                animateThreeJSRef.current()
              }
              
              // Verify bird is in scene and visible
              const birdInScene = sceneRef.current?.children.includes(birdMeshRef.current || {} as THREE.Mesh)
              console.log('🐦 Three.js bird animation started', {
                startPos: { x: buttonCenterX, y: buttonCenterY },
                waypointsCount: waypoints.length,
                birdVisible: birdMeshRef.current?.visible,
                birdInScene: birdInScene,
                sceneChildren: sceneRef.current?.children.length
              })
              
              // Don't call onBirdsFormed here - wait until animation completes
              // The animation loop will call it when the bird finishes flying
            }, pauseBeforeFlight) // Brief pause after transformation before flight starts
          }
        }, 0) // Start at time 0 - synchronized with button transformation
        
        // CRITICAL: Start the timeline IMMEDIATELY - this triggers the synchronized transformation
        console.log('🔄 Starting synchronized button-to-bird transformation')
        tl.play() // Start timeline immediately
      } else {
        console.error('❌ Cannot start Three.js bird animation - missing refs', {
          hasButton: !!buttonElement,
          hasButtonPosition: !!buttonPosition,
          hasBoid: !!boidRef.current,
          hasBirdMesh: !!birdMeshRef.current,
          hasCreateLoopWaypoints: !!createLoopWaypointsRef.current,
          hasAnimateThreeJS: !!animateThreeJSRef.current
        })
      }
    }
    
    // Start animation IMMEDIATELY - no delay to ensure button explosion happens right when bird appears
    // Use requestAnimationFrame to ensure DOM is ready, but don't delay unnecessarily
    requestAnimationFrame(() => {
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

