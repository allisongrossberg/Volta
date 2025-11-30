import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { LITERARY_FORMS, type LiteraryForm } from '../services/textGeneration'
import CircularArrowButton from './CircularArrowButton'

interface GeneratedContent {
  text: string
  imageUrl: string
  form: string
}

interface GooeyImageGalleryProps {
  onSelectForm: (form: LiteraryForm, imageUrl: string) => void
  onBackgroundColorChange?: (color: string) => void
  isVisible?: boolean // Only show progress bar when visible
  onBack?: () => void
  generatedContent?: Map<LiteraryForm, GeneratedContent>
}

interface GalleryItem {
  form: LiteraryForm
  label: string
  imageUrl: string
}

function GooeyImageGallery({ onSelectForm, onBackgroundColorChange, isVisible = true, onBack, generatedContent }: GooeyImageGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scenesRef = useRef<Map<string, { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer; mesh: THREE.Mesh; material: THREE.ShaderMaterial; scrollVelocity: number }>>(new Map())
  const animationFrameRef = useRef<number | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const scrollVelocityRef = useRef<Map<string, number>>(new Map())
  const lastScrollLeftRef = useRef<Map<string, number>>(new Map())
  const lastUpdateTimeRef = useRef<Map<string, number>>(new Map())
  const mouseOverPosRef = useRef<Map<string, { current: THREE.Vector2, target: THREE.Vector2 }>>(new Map())
  const mouseEnterRef = useRef<Map<string, number>>(new Map())
  const mouseEnterTargetRef = useRef<Map<string, number>>(new Map())

  // Use generated images if available, otherwise use placeholders
  // Use useMemo to recompute when generatedContent changes
  const galleryItems: GalleryItem[] = useMemo(() => {
    return LITERARY_FORMS.map(form => {
      const generated = generatedContent?.get(form.value)
      return {
        form: form.value,
        label: form.label,
        imageUrl: generated?.imageUrl || `https://picsum.photos/800/600?random=${form.value}` // Use generated image or placeholder
      }
    })
  }, [generatedContent])

  useEffect(() => {
    if (!containerRef.current) return
    
    // Scroll handler - defined outside initGallery so cleanup can access it
    let handleScroll: (() => void) | null = null
    
    // Wait for gallery to be visible and DOM to be ready
    const initGallery = () => {
      if (!containerRef.current) return
      
      // Check if gallery is visible
      const galleryElement = containerRef.current
      const isGalleryVisible = galleryElement.offsetWidth > 0 && galleryElement.offsetHeight > 0
      
      if (!isGalleryVisible) {
        // Retry after a short delay if not visible yet
        setTimeout(initGallery, 100)
        return
      }

      const items = containerRef.current.querySelectorAll('.gallery-item')
      
      // Lerp helper function (from Codrops)
      const lerp = (start: number, end: number, damping: number) => start * (1 - damping) + end * damping
      
      // Mouse tracking handlers (defined before use) - Codrops pattern
      const handleMouseMove = (e: MouseEvent, itemId: string, imageContainer: HTMLElement) => {
        const rect = imageContainer.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = 1.0 - (e.clientY - rect.top) / rect.height // Flip Y for GL coordinates
        const mousePos = mouseOverPosRef.current.get(itemId)
        if (mousePos) {
          mousePos.target.x = x
          mousePos.target.y = y
        }
      }
      
      const handleMouseEnter = (itemId: string) => {
        mouseEnterTargetRef.current.set(itemId, 1.0)
      }
      
      const handleMouseLeave = (itemId: string) => {
        mouseEnterTargetRef.current.set(itemId, 0.0)
        const mousePos = mouseOverPosRef.current.get(itemId)
        if (mousePos) {
          mousePos.target.x = 0.5
          mousePos.target.y = 0.5
        }
      }
      
      // Helper function to initialize a single gallery item
      // Helper function to initialize a single gallery item
      const initializeItem = (index: number, width: number, height: number) => {
        const item = items[index]
        if (!item) return
        
        const imageContainer = item.querySelector('.gallery-item-image') as HTMLElement
        const canvas = item.querySelector('canvas') as HTMLCanvasElement
        if (!canvas || !imageContainer) return

        // Scene setup
        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
        camera.position.z = 1

        const renderer = new THREE.WebGLRenderer({ 
          canvas,
          antialias: true,
          alpha: true
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

        // Create plane geometry with subdivisions for smooth wave deformation (Codrops pattern)
        const geometry = new THREE.PlaneGeometry(2, 2, 100, 100)

        // Scroll-based distortion shader (exact Codrops shader-on-scroll implementation)
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uTexture: { value: null },
            uScrollVelocity: { value: 0 }, // Horizontal scroll velocity (negative = left, positive = right)
            uMouseEnter: { value: 0 }, // 0-1 hover state
            uMouseOverPos: { value: new THREE.Vector2(0.5, 0.5) }, // Mouse position on image (0-1)
            uQuadSize: { value: new THREE.Vector2(1, 1) } // Size of quad for aspect ratio
          },
          vertexShader: `
            varying vec2 vUv;
            varying vec2 vUvCover;
            
            uniform vec2 uQuadSize;
            uniform float uScrollVelocity;
            
            vec3 deformationCurve(vec3 position, vec2 uv) {
              float PI = 3.141592653589793;
              // Horizontal deformation (adapted from vertical scroll)
              // Creates wave effect like paper waving in wind
              // For horizontal scroll, we deform along X axis based on Y position
              // Increase the multiplier to make the wave more visible
              position.x = position.x - (sin(uv.y * PI) * min(abs(uScrollVelocity), 5.0) * sign(uScrollVelocity) * -0.04);
              return position;
            }
            
            void main() {
              vUv = uv;
              // For now, use regular UV (we'd need texture size for proper cover)
              vUvCover = uv;
              
              // Apply deformation curve for wave effect
              vec3 deformedPosition = deformationCurve(position, vUvCover);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(deformedPosition, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            
            uniform float uTime;
            uniform sampler2D uTexture;
            uniform float uScrollVelocity; // Horizontal scroll velocity
            uniform float uMouseEnter; // 0-1 hover state
            uniform vec2 uMouseOverPos; // Mouse position (0-1)
            uniform vec2 uQuadSize; // Size of quad for aspect ratio
            
            varying vec2 vUv;
            varying vec2 vUvCover;
            
            // Ashima Arts Simplex Noise (exact Codrops implementation)
            vec3 mod289(vec3 x) {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec2 mod289(vec2 x) {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec3 permute(vec3 x) {
              return mod289(((x*34.0)+10.0)*x);
            }
            
            float snoise(vec2 v) {
              const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                                  0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                                 -0.577350269189626,  // -1.0 + 2.0 * C.x
                                  0.024390243902439); // 1.0 / 41.0
              // First corner
              vec2 i  = floor(v + dot(v, C.yy));
              vec2 x0 = v -   i + dot(i, C.xx);
              
              // Other corners
              vec2 i1;
              i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
              vec4 x12 = x0.xyxy + C.xxzz;
              x12.xy -= i1;
              
              // Permutations
              i = mod289(i);
              vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
              
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
              m = m*m;
              m = m*m;
              
              // Gradients
              vec3 x = 2.0 * fract(p * C.www) - 1.0;
              vec3 h = abs(x) - 0.5;
              vec3 ox = floor(x + 0.5);
              vec3 a0 = x - ox;
              
              // Normalise gradients
              m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
              
              // Compute final noise value
              vec3 g;
              g.x  = a0.x  * x0.x  + h.x  * x0.y;
              g.yz = a0.yz * x12.xz + h.yz * x12.yw;
              return 130.0 * dot(m, g);
            }
            
            void main() {
              vec2 texCoords = vUvCover;
              
              // Aspect ratio for circle calculation
              float aspectRatio = uQuadSize.y / uQuadSize.x;
              
              // Create a circle following the mouse (adapted for horizontal scroll)
              float circle = 1.0 - distance(
                vec2(uMouseOverPos.x, (1.0 - uMouseOverPos.y) * aspectRatio),
                vec2(vUv.x, vUv.y * aspectRatio)
              ) * 15.0;
              
              // Create noise using exact Codrops implementation
              float noise = snoise(gl_FragCoord.xy);
              
              // Modify texture coordinates (exact Codrops pattern)
              // Scroll velocity creates distortion when scrolling
              // Mouse enter creates localized circle distortion
              float scrollEffect = abs(uScrollVelocity) * 0.2;
              
              texCoords.x += mix(0.0, circle * noise * 0.02, uMouseEnter + scrollEffect);
              texCoords.y += mix(0.0, circle * noise * 0.02, uMouseEnter + scrollEffect);
              
              // Sample texture
              vec3 texture = vec3(texture2D(uTexture, texCoords));
              
              gl_FragColor = vec4(texture, 1.0);
            }
          `,
          transparent: true
        })

        // Load texture
        const textureLoader = new THREE.TextureLoader()
        const galleryItem = galleryItems[index]
        
        // Force portrait aspect ratio (3:4) for display even though images are square
        // This makes images appear taller and more rectangular
        const displayAspectRatio = 3 / 4 // width:height ratio (portrait)
        
        // Calculate container dimensions using forced portrait aspect ratio
        let finalWidth = width
        let finalHeight = width / displayAspectRatio // Calculate height based on width and aspect ratio
        
        // Ensure height doesn't exceed viewport
        if (finalHeight > window.innerHeight * 0.85) {
          finalHeight = window.innerHeight * 0.85
          finalWidth = finalHeight * displayAspectRatio
        }
        
          // Update container size to maintain aspect ratio
          if (imageContainer) {
            imageContainer.style.width = `${finalWidth}px`
            imageContainer.style.height = `${finalHeight}px`
            imageContainer.style.aspectRatio = '3 / 4'
          }
        
        // Update renderer size
        renderer.setSize(finalWidth, finalHeight)
        
        // Load image to get texture
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          
          // Load texture with the image
          textureLoader.load(
            galleryItem.imageUrl,
            (texture) => {
              texture.wrapS = THREE.ClampToEdgeWrapping
              texture.wrapT = THREE.ClampToEdgeWrapping
              texture.flipY = true // Flip Y to correct orientation
              // Don't set premultiplyAlpha - let Three.js handle it automatically to avoid WebGL warnings
              material.uniforms.uTexture.value = texture
              
              // Update quad size uniform for aspect ratio calculation
              material.uniforms.uQuadSize.value.set(finalWidth, finalHeight)
            },
            undefined,
            (error) => {
              console.error('Error loading texture:', error)
            }
          )
        }
        img.onerror = () => {
          // Fallback: use original dimensions
          textureLoader.load(
            galleryItem.imageUrl,
            (texture) => {
              texture.wrapS = THREE.ClampToEdgeWrapping
              texture.wrapT = THREE.ClampToEdgeWrapping
              texture.flipY = true
              material.uniforms.uTexture.value = texture
              material.uniforms.uQuadSize.value.set(width, height)
            },
            undefined,
            (error) => {
              console.error('Error loading texture:', error)
            }
          )
        }
        img.src = galleryItem.imageUrl

        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        // Store scene reference
        const itemId = galleryItem.form
        scenesRef.current.set(itemId, { scene, camera, renderer, mesh, material, scrollVelocity: 0 })
        scrollVelocityRef.current.set(itemId, 0)
        lastScrollLeftRef.current.set(itemId, containerRef.current?.scrollLeft || 0)
        lastUpdateTimeRef.current.set(itemId, performance.now())
        mouseOverPosRef.current.set(itemId, {
          current: new THREE.Vector2(0.5, 0.5),
          target: new THREE.Vector2(0.5, 0.5)
        })
        mouseEnterRef.current.set(itemId, 0)
        mouseEnterTargetRef.current.set(itemId, 0)
        
        // Add mouse event handlers for this image
        const mouseMoveHandler = (e: MouseEvent) => handleMouseMove(e, itemId, imageContainer)
        const mouseEnterHandler = () => handleMouseEnter(itemId)
        const mouseLeaveHandler = () => handleMouseLeave(itemId)
        
        imageContainer.addEventListener('mousemove', mouseMoveHandler)
        imageContainer.addEventListener('mouseenter', mouseEnterHandler)
        imageContainer.addEventListener('mouseleave', mouseLeaveHandler)
        
        // Store handlers for cleanup
        ;(imageContainer as any)._mouseMoveHandler = mouseMoveHandler
        ;(imageContainer as any)._mouseEnterHandler = mouseEnterHandler
        ;(imageContainer as any)._mouseLeaveHandler = mouseLeaveHandler
      }
    
      // Initialize all items
      items.forEach((item, index) => {
      const imageContainer = item.querySelector('.gallery-item-image') as HTMLElement
      const canvas = item.querySelector('canvas') as HTMLCanvasElement
      if (!canvas || !imageContainer) {
        console.warn(`Gallery item ${index}: Missing canvas or imageContainer`)
        return
      }

      // Wait for layout to settle before getting dimensions
      requestAnimationFrame(() => {
        const rect = imageContainer.getBoundingClientRect()
        let width = rect.width
        let height = rect.height
        
        // If dimensions are still 0, try offsetWidth/offsetHeight
        if (width === 0 || height === 0) {
          width = imageContainer.offsetWidth
          height = imageContainer.offsetHeight
        }
        
        // If still 0, retry after a delay
        if (width === 0 || height === 0) {
          setTimeout(() => {
            const retryRect = imageContainer.getBoundingClientRect()
            const retryWidth = retryRect.width || imageContainer.offsetWidth || 400
            const retryHeight = retryRect.height || imageContainer.offsetHeight || 600
            if (retryWidth > 0 && retryHeight > 0) {
              initializeItem(index, retryWidth, retryHeight)
            }
          }, 200)
          return
        }
        
        initializeItem(index, width, height)
      })
    })
    
    // Scroll tracking (Codrops pattern adapted for horizontal scroll)
    let scroll = {
      scrollLeft: containerRef.current?.scrollLeft || 0,
      scrollVelocity: 0
    }
    
    // Calculate scroll velocity (Codrops pattern - horizontal scroll)
    const updateScrollVelocity = () => {
      if (!containerRef.current) return
      
      const currentScrollLeft = containerRef.current.scrollLeft
      const currentTime = performance.now()
      
      // Calculate velocity for the container (like Lenis does)
      const lastScrollLeft = scroll.scrollLeft
      const lastUpdateTime = lastUpdateTimeRef.current.get('container') || currentTime
      const deltaTime = (currentTime - lastUpdateTime) / 1000
      const deltaScroll = currentScrollLeft - lastScrollLeft
      
      // Scroll velocity in pixels per second (Codrops pattern)
      // Lenis typically provides values in range -5 to +5 for normal scrolling
      let scrollVelocity = deltaTime > 0 ? deltaScroll / deltaTime : 0
      
      // Normalize to match Lenis scale (divide by ~100-200 for typical scroll speeds)
      // This makes the velocity values similar to what Lenis provides (-5 to +5 range)
      scrollVelocity = scrollVelocity / 150
      
      // Clamp velocity to reasonable range (like Lenis does)
      scrollVelocity = Math.max(-7, Math.min(7, scrollVelocity))
      
      // Decay velocity when not actively scrolling (smooth transition)
      if (Math.abs(deltaScroll) < 0.5) {
        scrollVelocity = scroll.scrollVelocity * 0.9
      }
      
      // Update scroll state
      scroll.scrollLeft = currentScrollLeft
      scroll.scrollVelocity = scrollVelocity
      lastUpdateTimeRef.current.set('container', currentTime)
      
      // Update all items with the same scroll velocity
      items.forEach((_item, index) => {
        const itemId = galleryItems[index]?.form
        if (!itemId) return
        
        scrollVelocityRef.current.set(itemId, scrollVelocity)
      })
    }

    // Animation loop (Codrops pattern)
    let time = 0
    const animate = () => {
      time += 0.016 // ~60fps
      
      updateScrollVelocity()
      
      scenesRef.current.forEach((sceneData, itemId) => {
        // Lerp mouse position (Codrops pattern)
        const mousePos = mouseOverPosRef.current.get(itemId)
        if (mousePos) {
          mousePos.current.x = lerp(mousePos.current.x, mousePos.target.x, 0.05)
          mousePos.current.y = lerp(mousePos.current.y, mousePos.target.y, 0.05)
        }
        
        // Lerp mouse enter (Codrops pattern with GSAP-like easing)
        const mouseEnterTarget = mouseEnterTargetRef.current.get(itemId) || 0
        const currentMouseEnter = mouseEnterRef.current.get(itemId) || 0
        const newMouseEnter = lerp(currentMouseEnter, mouseEnterTarget, 0.1) // Smooth transition
        mouseEnterRef.current.set(itemId, newMouseEnter)
        
        // Update uniforms (Codrops pattern)
        sceneData.material.uniforms.uTime.value = time
        sceneData.material.uniforms.uScrollVelocity.value = scroll.scrollVelocity
        if (mousePos) {
          sceneData.material.uniforms.uMouseOverPos.value.x = mousePos.current.x
          sceneData.material.uniforms.uMouseOverPos.value.y = mousePos.current.y
        }
        sceneData.material.uniforms.uMouseEnter.value = newMouseEnter
        
        sceneData.renderer.render(sceneData.scene, sceneData.camera)
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()
    
    // Also update on scroll for immediate response
    handleScroll = () => {
      updateScrollVelocity()
    }
    
    if (containerRef.current) {
      containerRef.current.addEventListener('scroll', handleScroll, { passive: true })
      window.addEventListener('scroll', handleScroll, { passive: true })
    }

    // Scroll animation observer - optimized for horizontal scrolling
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { 
        threshold: 0.2, 
        rootMargin: '0px 100px 0px 100px' // Horizontal margins for earlier trigger
      }
    )

    // Observe all gallery items
    items.forEach((item) => {
      observerRef.current?.observe(item)
    })
    } // Close initGallery function
    
    // Start initialization
    initGallery()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (containerRef.current && handleScroll) {
        containerRef.current.removeEventListener('scroll', handleScroll)
        window.removeEventListener('scroll', handleScroll)
      }
      scenesRef.current.forEach((sceneData) => {
        sceneData.renderer.dispose()
        sceneData.material.dispose()
        sceneData.mesh.geometry.dispose()
      })
      scenesRef.current.clear()
      scrollVelocityRef.current.clear()
      lastScrollLeftRef.current.clear()
      lastUpdateTimeRef.current.clear()
      mouseOverPosRef.current.clear()
      mouseEnterRef.current.clear()
    }
  }, []) // Empty dependency array - runs once on mount

  // Update textures when generatedContent changes
  useEffect(() => {
    if (!generatedContent || generatedContent.size === 0) return
    if (!containerRef.current) return
    if (scenesRef.current.size === 0) return // Wait for scenes to be initialized

    // Wait a bit for DOM to be ready
    const updateTextures = () => {
      const items = containerRef.current?.querySelectorAll('.gallery-item')
      if (!items || items.length === 0) return
      
      items.forEach((item, index) => {
        const galleryItem = galleryItems[index]
        if (!galleryItem) return
        
        const sceneData = scenesRef.current.get(galleryItem.form)
        if (!sceneData) return
        
        // Only update if we have a generated image (not placeholder)
        const generated = generatedContent.get(galleryItem.form)
        if (!generated?.imageUrl) return
        
        // Check if texture is already loaded with this URL
        const currentTexture = sceneData.material.uniforms.uTexture.value
        if (currentTexture && currentTexture.image && currentTexture.image.src === generated.imageUrl) {
          return // Already using this image
        }
        
        // Check if it's a placeholder URL (picsum)
        if (generated.imageUrl.includes('picsum.photos')) {
          return // Don't update if it's still a placeholder
        }
        
        // Load new texture - force portrait aspect ratio (2:3) for display
        const imageContainer = item.querySelector('.gallery-item-image') as HTMLElement
        if (imageContainer) {
          const rect = imageContainer.getBoundingClientRect()
          let containerWidth = rect.width || imageContainer.offsetWidth || 550
          
          // Force portrait aspect ratio (3:4)
          const displayAspectRatio = 3 / 4
          let finalWidth = containerWidth
          let finalHeight = containerWidth / displayAspectRatio
          
          // Ensure height doesn't exceed viewport
          if (finalHeight > window.innerHeight * 0.85) {
            finalHeight = window.innerHeight * 0.85
            finalWidth = finalHeight * displayAspectRatio
          }
          
          // Update container to maintain portrait aspect ratio
          imageContainer.style.width = `${finalWidth}px`
          imageContainer.style.height = `${finalHeight}px`
          imageContainer.style.aspectRatio = '3 / 4'
          
          // Update renderer size
          if (sceneData.renderer) {
            sceneData.renderer.setSize(finalWidth, finalHeight)
          }
          
          // Load texture directly (no need to preload image since we're forcing aspect ratio)
          const textureLoader = new THREE.TextureLoader()
          console.log(`🔄 Updating texture for ${galleryItem.form} with generated image: ${generated.imageUrl.substring(0, 50)}...`)
          textureLoader.load(
            generated.imageUrl,
            (texture) => {
              // Dispose old texture if it exists
              if (currentTexture && currentTexture !== texture) {
                currentTexture.dispose()
              }
              
              texture.wrapS = THREE.ClampToEdgeWrapping
              texture.wrapT = THREE.ClampToEdgeWrapping
              texture.flipY = true
              // Don't set premultiplyAlpha - let Three.js handle it automatically
              sceneData.material.uniforms.uTexture.value = texture
              
              if (finalWidth > 0 && finalHeight > 0) {
                sceneData.material.uniforms.uQuadSize.value.set(finalWidth, finalHeight)
              }
              
              console.log(`✅ Texture updated for ${galleryItem.form}`)
            },
            undefined,
            (error) => {
              console.error(`❌ Error loading texture for ${galleryItem.form}:`, error)
            }
          )
        }
      })
    }
    
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateTextures, 100)
    return () => clearTimeout(timeoutId)
  }, [generatedContent, galleryItems])

  // Calculate horizontal scroll progress for progress bar
  const [scrollProgress, setScrollProgress] = useState(0)
  const [backgroundColor, setBackgroundColor] = useState('#0e0502')
  const colorCacheRef = useRef<Map<string, string>>(new Map())
  const hoverTimeoutRef = useRef<number | null>(null)
  
  // Notify parent of initial background color
  useEffect(() => {
    onBackgroundColorChange?.('#0e0502')
  }, [onBackgroundColorChange])
  
  // Extract dominant color from image with caching
  const extractDominantColor = (imageUrl: string, callback: (color: string) => void) => {
    // Check cache first
    if (colorCacheRef.current.has(imageUrl)) {
      callback(colorCacheRef.current.get(imageUrl)!)
      return
    }
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
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
      // Cache the result
      colorCacheRef.current.set(imageUrl, finalColor)
      callback(finalColor)
    }
    img.src = imageUrl
  }
  
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      const container = containerRef.current
      const scrollLeft = container.scrollLeft
      const scrollWidth = container.scrollWidth - container.clientWidth
      const progress = scrollWidth > 0 ? (scrollLeft / scrollWidth) * 100 : 0
      setScrollProgress(progress)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll() // Initial calculation
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      // Clean up hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    }
  }, [])

  return (
    <>
      {onBack && (
        <CircularArrowButton 
          onClick={onBack}
          direction="back"
          position="top-left"
        />
      )}
      <div 
        ref={containerRef} 
        className="gooey-gallery"
        style={{ backgroundColor }}
      >
      {/* Background text - absolute positioned, before gallery-grid in DOM */}
      {isVisible && (
        <div className="gallery-background-text">
          <div className="gallery-background-text-choose">CHOOSE A</div>
          <div className="gallery-background-text-script">LITERARY FORM</div>
        </div>
      )}
      {/* Gallery grid - comes after background text in DOM, so it stacks on top */}
      <div className="gallery-grid">
        {galleryItems.map((item) => (
          <div
            key={item.form}
            className="gallery-item"
            onClick={() => onSelectForm(item.form, item.imageUrl)}
          >
            {/* Text on the left */}
            <div className="gallery-item-label">
              <h2>
                {(() => {
                  // Handle labels with & or OR - ensure exactly 2 lines
                  if (item.label.includes('&')) {
                    const parts = item.label.split('&')
                    // Put & on top line with first part
                    return (
                      <>
                        <span className="label-line label-line-top">{parts[0].trim()}&nbsp;&</span>
                        <span className="label-line label-line-bottom">{parts[1]?.trim()}</span>
                      </>
                    )
                  } else if (item.label.toLowerCase().includes(' or ')) {
                    // Case-insensitive match for "or"
                    const orIndex = item.label.toLowerCase().indexOf(' or ')
                    const beforeOr = item.label.slice(0, orIndex).trim()
                    const afterOr = item.label.slice(orIndex + 4).trim() // +4 for " or "
                    // Put OR on bottom line with second part
                    return (
                      <>
                        <span className="label-line label-line-top">{beforeOr}</span>
                        <span className="label-line label-line-bottom">OR&nbsp;{afterOr}</span>
                      </>
                    )
                  } else {
                    // Split multi-word labels into exactly two lines
                    const words = item.label.split(/\s+/).filter(w => w.length > 0)
                    if (words.length === 1) {
                      // Single word - split into two lines if long enough
                      if (item.label.length <= 4) {
                        // Very short - put on one line but offset
                        return <span className="label-line label-single">{item.label}</span>
                      } else {
                        // Split word roughly in half
                        const midPoint = Math.ceil(item.label.length / 2)
                        return (
                          <>
                            <span className="label-line label-line-top">{item.label.slice(0, midPoint)}</span>
                            <span className="label-line label-line-bottom">{item.label.slice(midPoint)}</span>
                          </>
                        )
                      }
                    } else {
                      // Multiple words - split roughly in half, ensuring exactly 2 lines
                      const midPoint = Math.ceil(words.length / 2)
                      const topLine = words.slice(0, midPoint).join(' ')
                      const bottomLine = words.slice(midPoint).join(' ')
                      return (
                        <>
                          <span className="label-line label-line-top">{topLine}</span>
                          <span className="label-line label-line-bottom">{bottomLine}</span>
                        </>
                      )
                    }
                  }
                })()}
              </h2>
              <span className="gallery-item-see-more">See more</span>
            </div>
            {/* Image on the right */}
            <div 
              className="gallery-item-image"
              onMouseEnter={() => {
                // Clear any pending timeout
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current)
                  hoverTimeoutRef.current = null
                }
                extractDominantColor(item.imageUrl, (color) => {
                  setBackgroundColor(color)
                  onBackgroundColorChange?.(color)
                })
              }}
              onMouseLeave={() => {
                // Add small delay to prevent flickering when moving between items
                hoverTimeoutRef.current = setTimeout(() => {
                  setBackgroundColor('#0e0502')
                  onBackgroundColorChange?.('#0e0502')
                  hoverTimeoutRef.current = null
                }, 100)
              }}
            >
              <canvas />
            </div>
          </div>
        ))}
      </div>
      
      {/* Background text - inside gallery container to ensure proper z-index stacking */}
      {/* Horizontal scroll progress bar - rendered via portal to avoid transform issues */}
      {isVisible && createPortal(
        <div 
          className="gallery-progress"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '2px',
            background: 'rgba(255, 255, 255, 0.2)',
            zIndex: 9998, // Below modal but above gallery content
            borderRadius: '1px',
            pointerEvents: 'none',
            display: 'block',
            margin: 0,
            padding: 0
          }}
        >
          <div className="gallery-progress-bar" style={{ width: `${scrollProgress}%` }} />
        </div>,
        document.body
      )}
      </div>
    </>
  )
}

export default GooeyImageGallery

