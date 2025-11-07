import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiteraryForm } from '../types'
import '../styles/InputPage.css'

const LITERARY_FORMS: { value: LiteraryForm; label: string; description: string }[] = [
  { value: 'poem', label: 'Short Poem', description: 'In the style of Robert Frost or Emily Dickinson' },
  { value: 'sonnet', label: 'Soliloquy or Sonnet', description: 'In the style of Shakespeare' },
  { value: 'epic', label: 'Short Epic', description: 'In the style of Homer' },
  { value: 'song', label: 'Catchy Pop Song', description: 'In the style of Taylor Swift' },
  { value: 'fable', label: 'Fairytale, Fable or Myth', description: 'In the style of old Scottish/Irish/Norse/Greek tales' },
  { value: 'proverb', label: 'Proverb', description: 'In the style of Buddhist or African proverbs' },
]

function InputPage() {
  const [hypothesis, setHypothesis] = useState('')
  const [literaryForm, setLiteraryForm] = useState<LiteraryForm>('poem')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!hypothesis.trim()) {
      alert('Please enter a hypothesis')
      return
    }

    // Store the data in sessionStorage to pass to loading page
    sessionStorage.setItem('reframeRequest', JSON.stringify({
      hypothesis: hypothesis.trim(),
      literaryForm,
    }))

    navigate('/loading')
  }

  return (
    <div className="input-page">
      <div className="input-container">
        <header className="input-header">
          <h1>ReFrame</h1>
          <p className="subtitle">Transform your scientific hypothesis into beautiful literature</p>
        </header>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="form-group">
            <label htmlFor="hypothesis">Enter your scientific hypothesis</label>
            <textarea
              id="hypothesis"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g., If plants are given more sunlight, then they will grow taller"
              rows={4}
              className="hypothesis-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="literaryForm">Select literary form</label>
            <select
              id="literaryForm"
              value={literaryForm}
              onChange={(e) => setLiteraryForm(e.target.value as LiteraryForm)}
              className="form-select"
            >
              {LITERARY_FORMS.map((form) => (
                <option key={form.value} value={form.value}>
                  {form.label} - {form.description}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="submit-button">
            ReFrame
          </button>
        </form>
      </div>
    </div>
  )
}

export default InputPage

