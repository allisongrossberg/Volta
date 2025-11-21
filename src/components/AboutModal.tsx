import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../styles/AboutModal.css'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
  triggerElement?: HTMLElement | null
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  // Render modal in a portal at document.body level to ensure it covers everything
  return createPortal(
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="about-modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>
        <h2 className="about-modal-title">About Volta</h2>
        <div className="about-modal-text">
          <p>
            Volta, from the Italian word for "turn", transforms scientific hypotheses into narrative forms. 
            Named for the volta in poetry, that pivotal moment when perspective shifts and reframes everything 
            that came before, this tool creates similar turns in how we understand scientific ideas.
          </p>
          <p>
            By translating hypotheses into sonnets, myths, or songs, Volta expands our notion of ways of knowing. 
            Scientific language privileges precision and falsifiability; literary language privileges metaphor, 
            ambiguity, and emotional resonance. When we translate between these modes, something changes. 
            A hypothesis bound by empirical constraints becomes freed through narrative possibility. We see familiar 
            concepts from unfamiliar angles. We notice the metaphors we've been using all along without realizing.
          </p>
          <p>
            The name also honors Alessandro Volta, whose pioneering work with electricity created its own kind 
            of transformation: converting chemical energy into electrical current. Similarly, Volta converts the 
            energy of scientific inquiry into the current of literary expression, revealing that these seemingly 
            disparate modes of understanding might not be so separate after all.
          </p>
          <p>
            <strong>How it works:</strong> Volta uses AI models to generate both the literary text and accompanying 
            images. The text generation employs language models to transform your hypothesis into various literary 
            forms, while image generation creates visual interpretations of the generated text. Please note that 
            AI-generated content may contain inaccuracies, biases, or unexpected interpretations. The results are 
            creative interpretations rather than factual translations, and should be understood as artistic 
            explorations of scientific concepts rather than authoritative representations.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
