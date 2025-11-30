import { useEffect, useRef, useState, useMemo } from 'react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import SplitType from 'split-type'
import { LITERARY_FORMS, type LiteraryForm } from '../services/textGeneration'
import CircularArrowButton from './CircularArrowButton'
import '../styles/DraggableGallery.css'

// Register GSAP plugins
gsap.registerPlugin(CustomEase)
CustomEase.create('hop', '0.9, 0, 0.1, 1')

interface GeneratedContent {
  text: string
  imageUrl: string
  form: string
}

interface DraggableGalleryProps {
  onBack?: () => void
  generatedContent?: Map<LiteraryForm, GeneratedContent>
  hypothesis?: string
  onCursorChange?: (type: 'default' | 'plus' | 'minus') => void
  onExpandedChange?: (isExpanded: boolean) => void
}

interface GalleryItem {
  form: LiteraryForm
  label: string
  imageUrl: string
}

function DraggableGallery({ onBack, generatedContent, onCursorChange, onExpandedChange }: DraggableGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [mouseHasMoved, setMouseHasMoved] = useState(false)
  
  const targetXRef = useRef(0)
  const targetYRef = useRef(0)
  const currentXRef = useRef(0)
  const currentYRef = useRef(0)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const dragVelocityXRef = useRef(0)
  const dragVelocityYRef = useRef(0)
  const lastDragTimeRef = useRef(0)
  const canDragRef = useRef(true)
  const originalPositionRef = useRef<{
    id: string
    rect: DOMRect
    imgSrc: string
    width: number
    height: number
    label: string
    nameText?: string
    numberText?: string
  } | null>(null)
  const expandedItemRef = useRef<HTMLDivElement | null>(null)
  const visibleItemsRef = useRef<Set<string>>(new Set())
  const lastXRef = useRef(0)
  const lastUpdateTimeRef = useRef(0)
  const isClosingRef = useRef(false)

  // Settings
  const settings = {
    baseWidth: 400,
    smallHeight: 330,
    largeHeight: 500,
    itemGap: 65,
    hoverScale: 1.05,
    expandedScale: 0.4,
    dragEase: 0.075,
    momentumFactor: 200,
    bufferZone: 3,
    borderRadius: 0,
    overlayOpacity: 0.9,
    overlayEaseDuration: 0.8,
    zoomDuration: 0.6,
  }

  // Use generated images if available, otherwise use placeholders
  // Only create items if we have generated content (don't show placeholders)
  const galleryItems: GalleryItem[] = useMemo(() => {
    // If no generated content, return empty array (don't show placeholders)
    if (!generatedContent || generatedContent.size === 0) {
      console.log('⏳ Waiting for generated content...')
      return []
    }
    
    const items: GalleryItem[] = []
    LITERARY_FORMS.forEach(form => {
      const generated = generatedContent.get(form.value)
      // Only use generated image, no fallback to placeholder
      if (generated?.imageUrl) {
        const imageUrl = generated.imageUrl
        console.log(`🖼️ Gallery item ${form.label}: ${imageUrl.substring(0, 80)}...`)
        items.push({
          form: form.value,
          label: form.label,
          imageUrl: imageUrl,
        })
      } else {
        console.warn(`⚠️ No image URL for ${form.label}`)
      }
    })
    
    console.log(`✅ Created ${items.length} gallery items from generated content`)
    return items
  }, [generatedContent])

  // Single row layout - all items same size for horizontal scrolling
  const itemSizes = [
    { width: settings.baseWidth, height: settings.largeHeight },
  ]

  // Horizontal layout - single row
  const cellWidth = settings.baseWidth + settings.itemGap

  // Get item size - all items same size for horizontal layout
  const getItemSize = () => {
    return itemSizes[0]
  }

  // Generate unique ID for grid position
  const getItemId = (col: number, row: number) => `${col},${row}`

  // Analyze image brightness at caption area and set text color accordingly
  const analyzeImageBrightness = (img: HTMLImageElement, captionElement: HTMLElement) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      
      ctx.drawImage(img, 0, 0)
      
      // Sample bottom-left area where caption is (bottom 20% of image, left 30%)
      const sampleWidth = Math.floor(canvas.width * 0.3)
      const sampleHeight = Math.floor(canvas.height * 0.2)
      const startX = 0
      const startY = canvas.height - sampleHeight
      
      const imageData = ctx.getImageData(startX, startY, sampleWidth, sampleHeight)
      const data = imageData.data
      
      // Calculate average brightness
      let totalBrightness = 0
      for (let i = 0; i < data.length; i += 4) {
        // RGB to brightness using luminance formula
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255
        totalBrightness += brightness
      }
      
      const avgBrightness = totalBrightness / (data.length / 4)
      
      // Set text color: black on light backgrounds (> 0.5), white on dark backgrounds
      const textColor = avgBrightness > 0.5 ? '#000000' : '#ffffff'
      const nameElement = captionElement.querySelector('.item-name') as HTMLElement
      const numberElement = captionElement.querySelector('.item-number') as HTMLElement
      
      if (nameElement) {
        nameElement.style.color = textColor
      }
      if (numberElement) {
        numberElement.style.color = textColor
      }
    } catch (error) {
      console.warn('Failed to analyze image brightness:', error)
      // Default to white on error
    }
  }

  // Update visible items - horizontal only with infinite looping
  const updateVisibleItems = () => {
    if (!canvasRef.current) return
    
    // Don't create items if we don't have gallery items yet
    if (galleryItems.length === 0) {
      return
    }

    const buffer = settings.bufferZone
    const viewWidth = window.innerWidth * (1 + buffer)
    const totalWidth = galleryItems.length * cellWidth
    
    // Only horizontal scrolling - row is always 0
    const row = 0
    // Calculate visible range with extra buffer for seamless wrapping
    const startCol = Math.floor((-currentXRef.current - viewWidth / 2) / cellWidth) - 1
    const endCol = Math.ceil((-currentXRef.current + viewWidth * 1.5) / cellWidth) + 1

    const currentItems = new Set<string>()

    // Create or update visible items - single row only with infinite loop
    for (let col = startCol; col <= endCol; col++) {
      // Use modulo to create infinite loop - wrap around gallery items
      // This allows seamless scrolling in both directions
      const itemNum = ((col % galleryItems.length) + galleryItems.length) % galleryItems.length
      const itemId = getItemId(col, row)
      currentItems.add(itemId)

      if (visibleItemsRef.current.has(itemId)) continue
      if (activeItemId === itemId && isExpanded) continue

      const itemSize = getItemSize()
      // Calculate position - for infinite loop, position based on actual column
      const centerOffset = (window.innerWidth - totalWidth) / 2
      // Position items based on actual column value for proper spacing
      // This ensures seamless wrapping without gaps
      const position = {
        x: centerOffset + col * cellWidth,
        y: 0,
      }
      const galleryItem = galleryItems[itemNum]

        // Create item element
        const item = document.createElement('div')
        item.className = 'item'
        item.id = itemId
        item.style.width = `${itemSize.width}px`
        item.style.height = `${itemSize.height}px`
        item.style.left = `${position.x}px`
        // Position items lower on the page, closer to the bottom
        const verticalOffset = 70 // Positive offset to move items down
        item.style.top = `${(window.innerHeight - itemSize.height) / 2 + verticalOffset}px`
        item.dataset.col = col.toString()
        item.dataset.row = row.toString()
        item.dataset.width = itemSize.width.toString()
        item.dataset.height = itemSize.height.toString()

        // Create image container
        const imageContainer = document.createElement('div')
        imageContainer.className = 'item-image-container'
        imageContainer.style.cursor = 'none'

        // Create image with retry logic
        const img = document.createElement('img')
        img.crossOrigin = 'anonymous'
        img.alt = galleryItem.label
        img.loading = 'lazy'
        
        // Retry logic with exponential backoff
        let retryCount = 0
        const maxRetries = 3
        
        const attemptLoad = (delay = 0) => {
          setTimeout(() => {
            // Clear previous handlers
            img.onload = null
            img.onerror = null
            
            // Set new handlers
            img.onload = () => {
              console.log(`✅ Image loaded for ${galleryItem.label}`)
              // Analyze image brightness and set text color
              if (img.complete && img.naturalWidth > 0) {
                const captionElement = item.querySelector('.item-caption') as HTMLElement
                if (captionElement) {
                  analyzeImageBrightness(img, captionElement)
                }
              }
            }
            
            img.onerror = () => {
              retryCount++
              if (retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
                console.warn(`⚠️ Failed to load image for ${galleryItem.label} (attempt ${retryCount}/${maxRetries}), retrying in ${backoffDelay}ms...`)
                // Clear src to reset the image element
                img.src = ''
                attemptLoad(backoffDelay)
              } else {
                console.warn(`❌ Failed to load image for ${galleryItem.label} after ${maxRetries} attempts: ${galleryItem.imageUrl.substring(0, 80)}...`)
              }
            }
            
            // Set src after handlers are attached to trigger load
            img.src = galleryItem.imageUrl
          }, delay)
        }
        
        // Add caption at bottom left (before image loads so it's available for brightness analysis)
        const captionElement = document.createElement('div')
        captionElement.className = 'item-caption'

        const nameElement = document.createElement('div')
        nameElement.className = 'item-name'
        nameElement.textContent = galleryItem.label
        captionElement.appendChild(nameElement)

        const numberElement = document.createElement('div')
        numberElement.className = 'item-number'
        numberElement.textContent = `#${(itemNum + 1).toString().padStart(2, '0')}`
        captionElement.appendChild(numberElement)

        item.appendChild(captionElement)
        
        attemptLoad()
        imageContainer.appendChild(img)
        item.appendChild(imageContainer)

        // Add hover handlers for cursor
        item.addEventListener('mouseenter', () => {
          if (onCursorChange && !isExpanded) {
            onCursorChange('plus')
          }
        })
        
        item.addEventListener('mouseleave', () => {
          if (onCursorChange && !isExpanded) {
            onCursorChange('default')
          }
        })

        // Add click handler
        item.addEventListener('click', () => {
          if (mouseHasMoved || isDragging) return
          handleItemClick(item, itemNum)
        })

        if (canvasRef.current) {
          canvasRef.current.appendChild(item)
          visibleItemsRef.current.add(itemId)
        }
    }

    // Remove items no longer visible
    visibleItemsRef.current.forEach((itemId) => {
      if (!currentItems.has(itemId) || (activeItemId === itemId && isExpanded)) {
        const item = document.getElementById(itemId)
        if (item && item.parentNode === canvasRef.current && canvasRef.current) {
          canvasRef.current.removeChild(item)
        }
        visibleItemsRef.current.delete(itemId)
      }
    })
  }

  // Handle item click
  const handleItemClick = (item: HTMLElement, itemIndex: number) => {
    if (isExpanded) {
      if (expandedItemRef.current) closeExpandedItem()
    } else {
      expandItem(item, itemIndex)
    }
  }

  // Expand item
  const expandItem = (item: HTMLElement, itemIndex: number) => {
    setIsExpanded(true)
    setActiveItemId(item.id)
    canDragRef.current = false
    
    // Update cursor to minus when expanded
    if (onCursorChange) {
      onCursorChange('minus')
    }
    if (onExpandedChange) {
      onExpandedChange(true)
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = 'none'
    }

    // Get image source from gallery item directly to ensure we use generated image
    const galleryItem = galleryItems[itemIndex]
    const imgSrc = galleryItem.imageUrl || item.querySelector('img')?.src || ''
    const itemWidth = parseInt(item.dataset.width || '400')
    const itemHeight = parseInt(item.dataset.height || '330')
    const label = galleryItem.label


    // Get caption elements and animate them out with SplitType
    const captionElement = item.querySelector('.item-caption') as HTMLElement
    const nameElement = item.querySelector('.item-name') as HTMLElement
    const numberElement = item.querySelector('.item-number') as HTMLElement
    
    if (captionElement && nameElement && numberElement) {
      
      // Create clone for animation
      const captionClone = captionElement.cloneNode(true) as HTMLElement
      captionClone.classList.add('caption-clone')
      const nameClone = captionClone.querySelector('.item-name') as HTMLElement
      const numberClone = captionClone.querySelector('.item-number') as HTMLElement
      
      if (nameClone && numberClone) {
        // Apply SplitType to clones
        const nameCloneSplit = new SplitType(nameClone, { types: 'words' })
        const numberCloneSplit = new SplitType(numberClone, { types: 'words' })
        
        // Position clone exactly over original
        const captionRect = captionElement.getBoundingClientRect()
        captionClone.style.position = 'fixed'
        captionClone.style.left = `${captionRect.left}px`
        captionClone.style.bottom = `${window.innerHeight - captionRect.bottom}px`
        captionClone.style.width = `${captionRect.width}px`
        captionClone.style.zIndex = '10002' // Explicitly set z-index
        document.body.appendChild(captionClone)
        
        // Hide original immediately and prevent flicker
        captionElement.style.opacity = '0'
        captionElement.style.visibility = 'hidden'
        
        // Animate clone out - fast and smooth
        gsap.to(nameCloneSplit.words, {
          y: '100%',
          opacity: 0,
          duration: 0.3, // Faster disappearance
          stagger: 0.02, // Faster stagger
          ease: 'power3.in',
        })
        
        gsap.to(numberCloneSplit.words, {
          y: '100%',
          opacity: 0,
          duration: 0.3, // Faster disappearance
          stagger: 0.015, // Faster stagger
          delay: 0.03, // Shorter delay
          ease: 'power3.in',
          onComplete: () => {
            if (captionClone.parentNode) {
              document.body.removeChild(captionClone)
            }
          },
        })
      }
    }

    const rect = item.getBoundingClientRect()
    originalPositionRef.current = {
      id: item.id,
      rect,
      imgSrc,
      width: itemWidth,
      height: itemHeight,
      label,
      nameText: nameElement?.textContent || '',
      numberText: numberElement?.textContent || '',
    }

    // Show overlay
    if (overlayRef.current) {
      overlayRef.current.classList.add('active')
      gsap.to(overlayRef.current, {
        opacity: settings.overlayOpacity,
        duration: settings.overlayEaseDuration,
        ease: 'power2.inOut',
      })
    }

    // Create expanded item
    const expandedItem = document.createElement('div')
    expandedItem.className = 'expanded-item'
    expandedItem.style.width = `${itemWidth}px`
    expandedItem.style.height = `${itemHeight}px`
    expandedItem.style.borderRadius = `${settings.borderRadius}px`

    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.alt = label
    
    // Retry logic with exponential backoff for expanded item image
    let retryCount = 0
    const maxRetries = 3
    
    const attemptLoadExpanded = (delay = 0) => {
      setTimeout(() => {
        // Clear previous handlers
        img.onload = null
        img.onerror = null
        
        // Set new handlers
        img.onload = () => {
          console.log(`✅ Expanded image loaded for ${label}`)
        }
        
        img.onerror = () => {
          retryCount++
          if (retryCount < maxRetries) {
            const backoffDelay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
            console.warn(`⚠️ Failed to load expanded image for ${label} (attempt ${retryCount}/${maxRetries}), retrying in ${backoffDelay}ms...`)
            // Clear src to reset the image element
            img.src = ''
            attemptLoadExpanded(backoffDelay)
          } else {
            console.warn(`❌ Failed to load expanded image for ${label} after ${maxRetries} attempts`)
          }
        }
        
        // Set src after handlers are attached to trigger load
        img.src = imgSrc
      }, delay)
    }
    
    attemptLoadExpanded()
    expandedItem.appendChild(img)

    // Add generated text overlay if available
    const generated = generatedContent?.get(galleryItem.form)
    console.log(`🔍 Checking for text overlay - form: ${galleryItem.form}, generated:`, generated)
    if (generated?.text) {
      console.log(`📝 Adding text overlay for ${galleryItem.label}:`, generated.text.substring(0, 50))
      const textOverlay = document.createElement('div')
      textOverlay.className = 'expanded-text-overlay'
      textOverlay.style.cursor = 'none'
      
      // Create inner container for better text layout
      const textContainer = document.createElement('div')
      textContainer.style.maxWidth = '90%'
      textContainer.style.margin = '0 auto'
      textContainer.textContent = generated.text
      textOverlay.appendChild(textContainer)
      
      // Start invisible, will animate in
      textOverlay.style.opacity = '0'
      expandedItem.appendChild(textOverlay)
        
      // Check if content is scrollable and add scroll indicators
      const updateScrollIndicators = () => {
        const isScrollable = textOverlay.scrollHeight > textOverlay.clientHeight
        const isAtTop = textOverlay.scrollTop < 10
        const isAtBottom = textOverlay.scrollTop + textOverlay.clientHeight >= textOverlay.scrollHeight - 10
        
        textOverlay.classList.toggle('scrollable-top', isScrollable && !isAtTop)
        textOverlay.classList.toggle('scrollable-bottom', isScrollable && !isAtBottom)
      }
        
      // Update scroll indicators on scroll
      textOverlay.addEventListener('scroll', updateScrollIndicators)
      
      // Add click handler to text overlay to close the image
      // Clicking anywhere on the text overlay (which covers the entire expanded item) closes it
      // Use the overlay's click handler as a reliable way to close
      textOverlay.addEventListener('click', (e) => {
        console.log('🔵 Text overlay clicked!')
        e.stopPropagation() // Prevent event from bubbling
        // Trigger the overlay click which we know works
        if (overlayRef.current) {
          overlayRef.current.click()
        }
      })
        
      // Check after content loads
      setTimeout(() => {
        updateScrollIndicators()
      }, 100)
        
      // Animate text overlay in after image expansion - smooth and quick
      gsap.to(textOverlay, {
        opacity: 1,
        duration: 0.4, // Faster appearance
        delay: settings.zoomDuration * 0.5, // Start appearing earlier
        ease: 'power2.out',
        onComplete: () => {
          console.log(`✅ Text overlay animation complete`)
          updateScrollIndicators()
        }
      })
    } else {
      console.warn(`⚠️ No text found for ${galleryItem.label} (form: ${galleryItem.form})`)
      console.log(`Available forms in generatedContent:`, generatedContent ? Array.from(generatedContent.keys()) : 'none')
    }

    // Add click handler to expanded item - this will work when clicking on image area
    // The text overlay covers the entire item, so we need to handle clicks there too
    // But this handler serves as a fallback
    expandedItem.addEventListener('click', (e) => {
      // If click is directly on the expanded item or image (not on text overlay)
      // Close immediately
      const target = e.target as HTMLElement
      if (target === expandedItem || target === expandedItem.querySelector('img')) {
        closeExpandedItem()
      }
      // Note: Clicks on text overlay are handled by the text overlay's click handler
    })
    
    // Add hover handlers to expanded item and overlay to keep minus cursor
    expandedItem.addEventListener('mouseenter', () => {
      if (onCursorChange) {
        onCursorChange('minus')
      }
    })
    
    // Also set cursor on overlay when hovering
    if (overlayRef.current) {
      overlayRef.current.addEventListener('mouseenter', () => {
        if (onCursorChange) {
          onCursorChange('minus')
        }
      })
    }
    
    document.body.appendChild(expandedItem)
    expandedItemRef.current = expandedItem

    // Fade out other items with GSAP
    document.querySelectorAll('.item').forEach((el) => {
      if (el !== item) {
        gsap.to(el, {
          opacity: 0,
          duration: settings.overlayEaseDuration,
          ease: 'power2.inOut',
        })
      }
    })

    // Animate expansion - smoother animation matching example
    const viewportWidth = window.innerWidth
    const targetWidth = viewportWidth * settings.expandedScale
    const aspectRatio = itemHeight / itemWidth
    const targetHeight = targetWidth * aspectRatio

    // Calculate initial position relative to viewport center
    const initialX = rect.left + itemWidth / 2 - window.innerWidth / 2
    const initialY = rect.top + itemHeight / 2 - window.innerHeight / 2


    gsap.fromTo(
      expandedItem,
      {
        width: itemWidth,
        height: itemHeight,
        x: initialX,
        y: initialY,
      },
      {
        width: targetWidth,
        height: targetHeight,
        x: 0,
        y: 0,
        duration: settings.zoomDuration, // Use the faster zoom duration
        ease: 'hop',
      }
    )
  }

  // Close expanded item
  const closeExpandedItem = () => {
    // Prevent multiple simultaneous close calls
    if (isClosingRef.current || !expandedItemRef.current || !originalPositionRef.current) return
    isClosingRef.current = true

    // Hide text overlay smoothly and quickly
    const textOverlay = expandedItemRef.current.querySelector('.expanded-text-overlay') as HTMLElement
    if (textOverlay) {
      gsap.to(textOverlay, {
        opacity: 0,
        duration: 0.3, // Quick fade out
        ease: 'power2.in',
      })
    }


    // Hide overlay
    if (overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: settings.overlayEaseDuration,
        ease: 'power2.inOut',
        onComplete: () => {
          if (overlayRef.current) {
            overlayRef.current.classList.remove('active')
          }
        },
      })
    }

    // Fade in other items with GSAP
    document.querySelectorAll('.item').forEach((el) => {
      if (el.id !== activeItemId) {
        gsap.to(el, {
          opacity: 1,
          duration: settings.overlayEaseDuration,
          delay: 0.3,
          ease: 'power2.inOut',
        })
      }
    })

    const originalItem = document.getElementById(activeItemId || '')
    if (!originalItem || !originalPositionRef.current) return

    const originalRect = originalPositionRef.current.rect
    const originalWidth = originalPositionRef.current.width
    const originalHeight = originalPositionRef.current.height

    // Use the stored original position (where item was when opened) to calculate target
    // This ensures we return to the exact same position, preventing carousel movement
    const targetX = originalRect.left + originalWidth / 2 - window.innerWidth / 2
    const targetY = originalRect.top + originalHeight / 2 - window.innerHeight / 2

    // Keep caption hidden - it will be shown after clone animation completes
    const captionElement = originalItem.querySelector('.item-caption') as HTMLElement
    if (captionElement) {
      captionElement.style.opacity = '0'
      captionElement.style.visibility = 'hidden' // Also hide with visibility to prevent flicker
    }

    // Start caption animation earlier (during shrink, not after)
    // This makes the text appear faster
    let captionClone: HTMLElement | null = null
    if (originalItem) {
      const captionElement = originalItem.querySelector('.item-caption') as HTMLElement
      const nameElement = originalItem.querySelector('.item-name') as HTMLElement
      const numberElement = originalItem.querySelector('.item-number') as HTMLElement
      
      if (captionElement && nameElement && numberElement && originalPositionRef.current) {
        // Reset the text content to ensure clean animation (matching example)
        const nameText = originalPositionRef.current.nameText || originalPositionRef.current.label || nameElement.textContent || ''
        const numberText = originalPositionRef.current.numberText || numberElement.textContent || ''
        nameElement.textContent = nameText
        numberElement.textContent = numberText

        // Create clone for animation - use cloneNode like example
        captionClone = captionElement.cloneNode(true) as HTMLElement
        captionClone.classList.add('caption-clone')
        const nameClone = captionClone.querySelector('.item-name') as HTMLElement
        const numberClone = captionClone.querySelector('.item-number') as HTMLElement
        
        if (nameClone && numberClone) {
          // Position clone exactly over original
          const captionRect = captionElement.getBoundingClientRect()
          captionClone.style.position = 'fixed'
          captionClone.style.left = `${captionRect.left}px`
          captionClone.style.bottom = `${window.innerHeight - captionRect.bottom}px`
          captionClone.style.width = `${captionRect.width}px`
          captionClone.style.zIndex = '10002' // Explicitly set z-index
          document.body.appendChild(captionClone)
          
          // Apply SplitType to the cloned elements - use words for both
          const nameCloneSplit = new SplitType(nameClone, { types: 'words' })
          const numberCloneSplit = new SplitType(numberClone, { types: 'words' })
          
          // Set initial state
          gsap.set(nameCloneSplit.words, { y: '100%', opacity: 0 })
          gsap.set(numberCloneSplit.words, { y: '100%', opacity: 0 })
          
          // Animate in - faster and starts earlier
          gsap.to(nameCloneSplit.words, {
            y: '0%',
            opacity: 1,
            duration: 0.4, // Faster animation
            stagger: 0.02, // Faster stagger
            ease: 'power3.out',
          })
          
          gsap.to(numberCloneSplit.words, {
            y: '0%',
            opacity: 1,
            duration: 0.4, // Faster animation
            stagger: 0.015, // Faster stagger
            delay: 0.03, // Shorter delay
            ease: 'power3.out',
            onComplete: () => {
              // Show the original caption
              captionElement.style.opacity = '1'
              captionElement.style.visibility = 'visible'
              // Remove the clone
              if (captionClone && captionClone.parentNode) {
                document.body.removeChild(captionClone)
              }
            },
          })
        }
      }
    }

    // Animate back to original position with smooth easing
    gsap.to(expandedItemRef.current, {
      width: originalWidth,
      height: originalHeight,
      x: targetX,
      y: targetY,
      duration: settings.zoomDuration,
      ease: 'hop', // Use registered CustomEase "hop" easing curve
      onComplete: () => {

        if (expandedItemRef.current && expandedItemRef.current.parentNode) {
          document.body.removeChild(expandedItemRef.current)
        }
        expandedItemRef.current = null
        setIsExpanded(false)
        setActiveItemId(null)
        
        // Reset cursor to default when closed
        if (onCursorChange) {
          onCursorChange('default')
        }
        if (onExpandedChange) {
          onExpandedChange(false)
        }
        
        // Re-enable dragging only after everything is cleaned up
        canDragRef.current = true
        if (containerRef.current) {
          containerRef.current.style.cursor = 'none'
        }
        // Reset drag velocity to prevent any momentum from affecting position
        dragVelocityXRef.current = 0
        dragVelocityYRef.current = 0
        // Ensure target matches current to prevent any movement
        targetXRef.current = currentXRef.current
        targetYRef.current = currentYRef.current
        
        // Reset closing flag to allow future closes
        isClosingRef.current = false
      },
    })
  }

  // Animation loop
  useEffect(() => {
    let animationId: number
    
    const animate = () => {
      if (canDragRef.current) {
        const ease = settings.dragEase
        currentXRef.current += (targetXRef.current - currentXRef.current) * ease
        currentYRef.current += (targetYRef.current - currentYRef.current) * ease

        if (canvasRef.current) {
          // Only horizontal translation
          canvasRef.current.style.transform = `translateX(${currentXRef.current}px)`
        }

        // Infinite loop wrapping - create seamless infinite scroll
        if (galleryItems.length > 0) {
          const totalWidth = galleryItems.length * cellWidth
          // Wrap when scrolled past one full cycle in either direction
          // This creates a seamless infinite loop
          if (currentXRef.current <= -totalWidth) {
            currentXRef.current += totalWidth
            targetXRef.current += totalWidth
            // Force immediate update to prevent gaps
            updateVisibleItems()
          } else if (currentXRef.current >= totalWidth) {
            currentXRef.current -= totalWidth
            targetXRef.current -= totalWidth
            // Force immediate update to prevent gaps
            updateVisibleItems()
          }
        }

        const now = Date.now()
        // Only check horizontal movement for horizontal-only layout
        const distMoved = Math.abs(currentXRef.current - lastXRef.current)

        if (distMoved > 100 || now - lastUpdateTimeRef.current > 120) {
          updateVisibleItems()
          lastXRef.current = currentXRef.current
          lastUpdateTimeRef.current = now
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mouse drag handlers
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!canDragRef.current) return
      setIsDragging(true)
      setMouseHasMoved(false)
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      if (containerRef.current) {
        containerRef.current.style.cursor = 'none'
        containerRef.current.classList.add('dragging')
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !canDragRef.current) return

      const dx = e.clientX - startXRef.current
      // Only consider horizontal movement for horizontal-only layout
      if (Math.abs(dx) > 5) {
        setMouseHasMoved(true)
      }

      const now = Date.now()
      const dt = Math.max(10, now - lastDragTimeRef.current)
      lastDragTimeRef.current = now

      dragVelocityXRef.current = dx / dt
      dragVelocityYRef.current = 0 // No vertical velocity

      targetXRef.current += dx
      // Keep Y at 0 for horizontal-only layout
      targetYRef.current = 0

      startXRef.current = e.clientX
      startYRef.current = e.clientY
    }

    const handleMouseUp = () => {
      if (!isDragging) return
      setIsDragging(false)

      if (canDragRef.current) {
        if (containerRef.current) {
          containerRef.current.style.cursor = 'none'
          containerRef.current.classList.remove('dragging')
        }

        // Only apply horizontal momentum
        if (Math.abs(dragVelocityXRef.current) > 0.1) {
          targetXRef.current += dragVelocityXRef.current * settings.momentumFactor
        }
        // Keep Y at 0
        targetYRef.current = 0
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (!canDragRef.current) return
      setIsDragging(true)
      setMouseHasMoved(false)
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
      if (containerRef.current) {
        containerRef.current.classList.add('dragging')
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !canDragRef.current) return

      const dx = e.touches[0].clientX - startXRef.current
      // Only consider horizontal movement for horizontal-only layout
      if (Math.abs(dx) > 5) {
        setMouseHasMoved(true)
      }

      targetXRef.current += dx
      // Keep Y at 0 for horizontal-only layout
      targetYRef.current = 0

      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      if (containerRef.current) {
        containerRef.current.classList.remove('dragging')
      }
    }

    if (containerRef.current) {
      containerRef.current.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      containerRef.current.addEventListener('touchstart', handleTouchStart)
      window.addEventListener('touchmove', handleTouchMove)
      window.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        containerRef.current.removeEventListener('touchstart', handleTouchStart)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging])

  // Overlay click handler
  useEffect(() => {
    const handleOverlayClick = () => {
      if (isExpanded && expandedItemRef.current) {
        closeExpandedItem()
      }
    }

    if (overlayRef.current) {
      overlayRef.current.addEventListener('click', handleOverlayClick)
    }

    return () => {
      if (overlayRef.current) {
        overlayRef.current.removeEventListener('click', handleOverlayClick)
      }
    }
  }, [isExpanded])

  // Initialize visible items only when we have gallery items
  useEffect(() => {
    if (galleryItems.length > 0) {
      updateVisibleItems()
    } else {
      // Clear canvas if no items
      if (canvasRef.current) {
        canvasRef.current.innerHTML = ''
        visibleItemsRef.current.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryItems.length])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (isExpanded && expandedItemRef.current && originalPositionRef.current) {
        const viewportWidth = window.innerWidth
        const targetWidth = viewportWidth * settings.expandedScale
        const aspectRatio = originalPositionRef.current.height / originalPositionRef.current.width
        const targetHeight = targetWidth * aspectRatio

        gsap.to(expandedItemRef.current, {
          width: targetWidth,
          height: targetHeight,
          duration: 0.3,
          ease: 'power2.out',
        })
      } else {
        updateVisibleItems()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isExpanded])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {onBack && (
        <CircularArrowButton
          onClick={onBack}
          direction="back"
          position="top-left"
        />
      )}
      <div ref={containerRef} className="draggable-gallery-container">
        <div ref={canvasRef} className="canvas" />
        <div ref={overlayRef} className="overlay" />
        <div className="drag-indicator">
          <div className="swipe-gesture">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 12L3 8M7 12L3 16M7 12H21M17 12L21 8M17 12L21 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5"/>
            </svg>
          </div>
          <span>Swipe to explore</span>
        </div>
      </div>
    </div>
  )
}

export default DraggableGallery

