import React from 'react'
import ReactDom from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'
<<<<<<< HEAD
=======
import App from './components/App.jsx'
>>>>>>> b710310 (connect to supabase)

ReactDom.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)
