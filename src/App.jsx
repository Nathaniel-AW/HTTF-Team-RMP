import { Routes, Route } from 'react-router'
import Layout from './components/Layout copy'
import HomePage from './pages/homepage'
import SearchResults from './pages/searchResults.jsx'
import './index.css'

//supabase const
import SupabaseTest from './components/SupabaseTest.jsx'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={
          <Layout pageTitle="Professor Review">
            <header>
              <h1>HTTF Team RMP</h1>
              <p>Supabase client configured; inspect the data below.</p>
            </header>
            <SupabaseTest />
            <HomePage />
          </Layout>
        } />
        <Route path="/searchResults" element={
          <Layout pageTitle="Search Results" pageSubtitle="Here are the list of professors we identified from you inputs:">
            <SearchResults />
          </Layout>
      } />
        <Route path="/studentScore" element={
            <Layout pageTitle="Student Base Score">
              <studentScore />
            </Layout>
        } />
        <Route path="/professorScore" element={
          <Layout pageTitle="Search Results">
            <professorScore />
          </Layout>
      } />
      </Routes>
    </>
  )
}

export default App
