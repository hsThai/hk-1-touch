import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login';
import StaffManager from './pages/StaffManager';
import ChangePassword from './pages/ChangePassword';
import MainBoard from './pages/MainBoard';
import CustomerManager from './pages/CustomerManager';
import Settings from './pages/Settings';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
