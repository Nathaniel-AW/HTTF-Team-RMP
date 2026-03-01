import { Routes, Route } from 'react-router'
import Layout from './components/Layout copy'
import HomePage from './pages/homepage'
import './index.css'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={
          <Layout pageTitle="Hello">
            <header>
              <h1>HTTF Team RMP</h1>
              <p>RateMyProf review summarizer</p>
            </header>
            <HomePage />
          </Layout>
        } />
        <Route path="/goal-setting" element={
          <Layout pageTitle="Solace - Goal Setting" pageSubtitle="Define and track your personalized wellness objectives">
            <searchResults />
          </Layout>
      } />
      </Routes>
    </>
  )
}

export default App
