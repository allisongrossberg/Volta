import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../styles/InfoPopover.css'

interface InfoPopoverProps {
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function InfoPopover({ content, position = 'top' }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = 320
      const popoverHeight = 200
      const spacing = 8

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = triggerRect.top - popoverHeight - spacing
          left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2)
          break
        case 'bottom':
          top = triggerRect.bottom + spacing
          left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2)
          break
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (popoverHeight / 2)
          left = triggerRect.left - popoverWidth - spacing
          break
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (popoverHeight / 2)
          left = triggerRect.right + spacing
          break
      }

      // Keep within viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (left < 10) left = 10
      if (left + popoverWidth > viewportWidth - 10) left = viewportWidth - popoverWidth - 10
      if (top < 10) top = 10
      if (top + popoverHeight > viewportHeight - 10) top = viewportHeight - popoverHeight - 10

      setPopoverPosition({ top, left })
    }
  }, [isOpen, position])

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false)
        }
      }

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        className="info-popover-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Show information"
        type="button"
      >
        ?
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="info-popover-content"
            style={{
              top: `${popoverPosition.top}px`,
              left: `${popoverPosition.left}px`,
            }}
          >
            <div className="info-popover-inner">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

