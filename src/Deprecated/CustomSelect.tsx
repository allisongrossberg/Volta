import { useState, useRef, useEffect } from 'react'
import { LITERARY_FORMS, type LiteraryForm } from '../services/textGeneration'
import '../styles/CustomSelect.css'

interface CustomSelectProps {
  value: LiteraryForm
  onChange: (value: LiteraryForm) => void
  disabled?: boolean
  id?: string
}

export default function CustomSelect({ value, onChange, disabled = false, id }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedOption = LITERARY_FORMS.find(form => form.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Close on escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false)
        }
      }
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  const handleSelect = (formValue: LiteraryForm) => {
    onChange(formValue)
    setIsOpen(false)
    // Return focus to button after selection
    buttonRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        setIsOpen(!isOpen)
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          const currentIndex = LITERARY_FORMS.findIndex(f => f.value === value)
          const nextIndex = (currentIndex + 1) % LITERARY_FORMS.length
          onChange(LITERARY_FORMS[nextIndex].value)
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          const currentIndex = LITERARY_FORMS.findIndex(f => f.value === value)
          const prevIndex = currentIndex === 0 ? LITERARY_FORMS.length - 1 : currentIndex - 1
          onChange(LITERARY_FORMS[prevIndex].value)
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div className="custom-select-wrapper" ref={selectRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`custom-select-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select literary form"
      >
        <span className="custom-select-value">
          {selectedOption?.label || 'Select...'}
        </span>
        <span className="custom-select-arrow" aria-hidden="true"></span>
      </button>
      
      {isOpen && (
        <div className="custom-select-dropdown" role="listbox">
          {LITERARY_FORMS.map((form) => (
            <button
              key={form.value}
              type="button"
              role="option"
              aria-selected={form.value === value}
              className={`custom-select-option ${form.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(form.value)}
              onMouseEnter={(e) => e.currentTarget.focus()}
            >
              {form.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

