import React from 'react'
import ReactDom from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'

ReactDom.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)
