import { Routes, Route } from 'react-router'
import Layout from './components/Layout copy'
import HomePage from './pages/homepage'
import EndScore from './pages/endScore.jsx'
import Summary from './pages/summary.jsx'
import './index.css'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={
          <Layout pageTitle="AI-Powered Professor Feedback & Course Preparation Web App">
            <HomePage />
          </Layout>
        } />
        <Route path="/endScore" element={
            <Layout pageTitle="Final Score">
              <EndScore />
            </Layout>
        } />
        <Route path="/summary" element={
            <Layout pageTitle="Summary">
              <Summary />
            </Layout>
        } />
      </Routes>
    </>
  )
}

export default App
