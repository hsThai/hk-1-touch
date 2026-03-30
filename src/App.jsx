import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainBoard from './pages/MainBoard';
import SparePartModal from './pages/SparePartModal';
import CustomerManager from './pages/CustomerManager';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Index from './pages/Index';
import StaffManager from './pages/StaffManager';
import ChangePassword from './pages/ChangePassword';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
