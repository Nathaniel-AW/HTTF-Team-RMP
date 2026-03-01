import { Routes, Route } from 'react-router'
import AppShell from './layout/AppShell'
import HomePage from './pages/homepage'
import EndScore from './pages/endScore.jsx'
import CourseSelection from './pages/courseSelection.jsx'
import Summary from './pages/summary.jsx'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell>
            <HomePage />
          </AppShell>
        }
      />
      <Route
        path="/endScore"
        element={
          <AppShell>
            <EndScore />
          </AppShell>
        }
      />
      <Route
        path="/courseSelection"
        element={
          <AppShell>
            <CourseSelection />
          </AppShell>
        }
      />
      <Route
        path="/summary"
        element={
          <AppShell>
            <Summary />
          </AppShell>
        }
      />
    </Routes>
  )
}

export default App
