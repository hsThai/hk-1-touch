import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SparePartModal from './pages/SparePartModal';
import StaffManager from './pages/StaffManager';
import CustomerManager from './pages/CustomerManager';
import ChangePassword from './pages/ChangePassword';
import Index from './pages/Index';
import Home from './pages/Home';
import MainBoard from './pages/MainBoard';
import Login from './pages/Login';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MainBoard" element={<MainBoard />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
