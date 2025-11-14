import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AnimationPage from './pages/AnimationPage'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/" element={<AnimationPage />} />
      </Routes>
    </Router>
  )
}

export default App

