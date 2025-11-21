import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AnimationPageDirect from './pages/AnimationPageDirect'

function App() {
  return (
    <Router
      basename="/Volta"
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/" element={<AnimationPageDirect />} />
      </Routes>
    </Router>
  )
}

export default App

