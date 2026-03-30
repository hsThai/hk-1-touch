import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Index from './pages/Index';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Home from './pages/Home';
import MediaViewer from './pages/MediaViewer';
import Settings from './pages/Settings';
import OrderDrawer from './pages/OrderDrawer';
import OrderForms from './pages/OrderForms';
import CustomerManager from './pages/CustomerManager';
import StaffManager from './pages/StaffManager';
import QRComponents from './pages/QRComponents';
import SparePartModal from './pages/SparePartModal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
