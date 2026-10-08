import React from 'react'
import ReactDOM from 'react-dom/client'
import { startAutoUpdate } from './utils/autoUpdate.js'
import MainApp from './pages/MainApp'

ReactDOM.createRoot(document.getElementById('root')).render(
  <MainApp />
)

startAutoUpdate()
