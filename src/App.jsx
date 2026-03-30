import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerManager from './pages/CustomerManager';
import SparePartModal from './pages/SparePartModal';
import ChangePassword from './pages/ChangePassword';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Index from './pages/Index';
import Home from './pages/Home';
import StaffManager from './pages/StaffManager';
import MainBoard from './pages/MainBoard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/MainBoard" element={<MainBoard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
