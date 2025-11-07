import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import LoadingPage from './pages/LoadingPage'
import OutputPage from './pages/OutputPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/output" element={<OutputPage />} />
      </Routes>
    </Router>
  )
}

export default App

