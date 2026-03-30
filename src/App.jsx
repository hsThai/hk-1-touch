import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import StaffManager from './pages/StaffManager';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import SparePartModal from './pages/SparePartModal';
import CustomerManager from './pages/CustomerManager';
import Settings from './pages/Settings';
import MainBoard from './pages/MainBoard';
import Index from './pages/Index';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
