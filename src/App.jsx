import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerManager from './pages/CustomerManager';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Home from './pages/Home';
import Settings from './pages/Settings';
import MainBoard from './pages/MainBoard';
import StaffManager from './pages/StaffManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/StaffManager" element={<StaffManager />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
