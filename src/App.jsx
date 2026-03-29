import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerManager from './pages/CustomerManager';
import StaffManager from './pages/StaffManager';
import Home from './pages/Home';
import ChangePassword from './pages/ChangePassword';
import MainBoard from './pages/MainBoard';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
