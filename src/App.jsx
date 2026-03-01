import { Routes, Route } from 'react-router'
import Layout from './components/Layout copy'
import HomePage from './pages/homepage'
import SearchResults from './pages/searchResults.jsx'
import EndScore from './pages/endScore.jsx'
import './index.css'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={
          <Layout pageTitle="Professor Review">
            <HomePage />
          </Layout>
        } />
        <Route path="/searchResults" element={
          <Layout pageTitle="Search Results" pageSubtitle="Here are the list of professors we identified from you inputs:">
            <SearchResults />
          </Layout>
      } />
        <Route path="/endScore" element={
            <Layout pageTitle="Final Score">
              <EndScore />
            </Layout>
        } />
      </Routes>
    </>
  )
}

export default App
