import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Index from './pages/Index';
import Settings from './pages/Settings';
import SparePartModal from './pages/SparePartModal';
import CustomerManager from './pages/CustomerManager';
import StaffManager from './pages/StaffManager';
import MainBoard from './pages/MainBoard';
import ChangePassword from './pages/ChangePassword';
import Login from './pages/Login';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
