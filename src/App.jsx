import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerManager from './pages/CustomerManager';
import MainBoard from './pages/MainBoard';
import ChangePassword from './pages/ChangePassword';
import StaffManager from './pages/StaffManager';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
