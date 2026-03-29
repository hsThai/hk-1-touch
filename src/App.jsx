import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChangePassword from './pages/ChangePassword';
import Home from './pages/Home';
import CustomerManager from './pages/CustomerManager';
import Login from './pages/Login';
import StaffManager from './pages/StaffManager';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Settings from './pages/Settings';
import MainBoard from './pages/MainBoard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/MainBoard" element={<MainBoard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
