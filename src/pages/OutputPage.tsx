import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReframeResponse } from '../types'
import { useDynamicTheme } from '../hooks/useDynamicTheme'
import '../styles/OutputPage.css'

function OutputPage() {
  const navigate = useNavigate()
  const [response, setResponse] = useState<ReframeResponse | null>(null)

  // Apply dynamic theming based on color palette
  useDynamicTheme(response?.colorPalette)

  useEffect(() => {
    // Get the response data from sessionStorage
    const responseData = sessionStorage.getItem('reframeResponse')
    if (!responseData) {
      navigate('/')
      return
    }

    const reframeResponse: ReframeResponse = JSON.parse(responseData)
    setResponse(reframeResponse)
  }, [navigate])

  const handleNewReframe = () => {
    sessionStorage.removeItem('reframeRequest')
    sessionStorage.removeItem('reframeResponse')
    navigate('/')
  }

  if (!response) {
    return (
      <div className="output-page">
        <div className="output-container">Loading...</div>
      </div>
    )
  }

  return (
    <div className="output-page">
      <div className="output-container">
        <header className="output-header">
          <h1>Your ReFramed Hypothesis</h1>
          <button onClick={handleNewReframe} className="new-reframe-button">
            Create Another
          </button>
        </header>

        <div className="output-content">
          {response.illustrationUrl && (
            <section className="illustration-output">
              <h2>Illustration</h2>
              <div className="illustration-container">
                <img 
                  src={response.illustrationUrl} 
                  alt="Generated illustration" 
                  className="illustration-image"
                />
              </div>
            </section>
          )}

          <section className="literary-output">
            <h2>Literary Translation</h2>
            <div className="literary-text">
              {response.literaryText.split('\n').map((line, index) => (
                <p key={index}>{line || '\u00A0'}</p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default OutputPage

