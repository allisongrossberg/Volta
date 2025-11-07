import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReframeRequest } from '../types'
import { generateReframe } from '../services/api'
import '../styles/LoadingPage.css'

function LoadingPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processReframe = async () => {
      // Get the request data from sessionStorage
      const requestData = sessionStorage.getItem('reframeRequest')
      if (!requestData) {
        navigate('/')
        return
      }

      const request: ReframeRequest = JSON.parse(requestData)
      console.log('Processing reframe request:', request)

      try {
        // Call the API to generate the reframe
        const response = await generateReframe(request)
        console.log('Reframe generation complete:', response)
        
        // Store the response in sessionStorage
        sessionStorage.setItem('reframeResponse', JSON.stringify(response))
        
        // Navigate to output page
        navigate('/output')
      } catch (error) {
        console.error('Error generating reframe:', error)
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        setError(errorMessage)
        // Don't navigate away - show error on this page
      }
    }

    processReframe()
  }, [navigate])

  if (error) {
    return (
      <div className="loading-page">
        <div className="loading-container">
          <div className="error-message">
            <h2>Error</h2>
            <p>{error}</p>
            <button 
              onClick={() => {
                sessionStorage.removeItem('reframeRequest')
                navigate('/')
              }}
              className="retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="loading-page">
      <div className="loading-container">
        <div className="spinner"></div>
        <h2>Transforming your hypothesis...</h2>
        <p>We're working with Claude and Sora to create something beautiful</p>
      </div>
    </div>
  )
}

export default LoadingPage

