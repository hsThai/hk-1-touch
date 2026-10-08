import React from 'react'
import ReactDOM from 'react-dom/client'
import { startAutoUpdate } from './utils/autoUpdate.js'
import MainApp from './pages/MainApp'
import OrderPublic from './pages/OrderPublic.jsx'

// Trang công khai cho khách (không cần đăng nhập): /OrderPublic?code=SC... hoặc ?code=BL...
const PUBLIC_PATH = /^\/orderpublic/i.test(window.location.pathname);
ReactDOM.createRoot(document.getElementById('root')).render(
  PUBLIC_PATH ? <OrderPublic /> : <MainApp />
)

startAutoUpdate()
