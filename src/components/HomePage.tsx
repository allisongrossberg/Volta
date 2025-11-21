import { useRef } from 'react'
import CircularArrowButton from './CircularArrowButton'
import '../styles/HomePage.css'

interface HomePageProps {
  hypothesis: string
  onHypothesisChange: (hypothesis: string) => void
  onSubmit: () => void
  onReadMore: () => void
}

function HomePage({ hypothesis, onHypothesisChange, onSubmit, onReadMore }: HomePageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (hypothesis.trim()) {
      onSubmit()
    } else {
      // Shake animation for empty input
      if (textareaRef.current) {
        textareaRef.current.classList.add('shake')
        setTimeout(() => {
          textareaRef.current?.classList.remove('shake')
        }, 500)
      }
    }
  }
  
  const handleButtonClick = () => {
    if (hypothesis.trim()) {
      onSubmit()
    }
  }


  return (
    <div className="home-page">
      <div className="home-container">
        {/* VOLTA title at top */}
        <h1 className="home-title">VOLTA</h1>

        {/* Main content area - two columns */}
        <div className="home-content">
          {/* Right side - text input and forward arrow */}
          <div className="home-right">
            <form onSubmit={handleSubmit} className="home-form">
              <div className="form-group">
                <p className="home-instructions">
                  ENTER A SCIENTIFIC HYPOTHESIS. RE-IMAGINE IT IN LITERARY FORM.
                </p>
                <div className="textarea-wrapper">
                  <textarea
                    ref={textareaRef}
                    id="hypothesis"
                    className="hypothesis-input"
                    value={hypothesis}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.length <= 300) {
                        onHypothesisChange(value)
                      }
                    }}
                    placeholder="Enter your hypothesis here..."
                    rows={3}
                    maxLength={300}
                  />
                  <div className="char-count">
                    {hypothesis.length}/300
                  </div>
                </div>
                <CircularArrowButton 
                  onClick={handleButtonClick}
                  disabled={!hypothesis.trim()}
                />
              </div>
            </form>
          </div>
        </div>

        {/* Read About Me link at bottom right */}
        <div className="home-about-link">
          <span 
            className="read-about-link"
            onClick={onReadMore}
          >
            Read About Me
          </span>
        </div>
      </div>
    </div>
  )
}

export default HomePage

