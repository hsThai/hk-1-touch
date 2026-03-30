import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Settings from './pages/Settings';
import Home from './pages/Home';
import CustomerManager from './pages/CustomerManager';
import StaffManager from './pages/StaffManager';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import ChangePassword from './pages/ChangePassword';
import Login from './pages/Login';
import QRComponents from './pages/QRComponents';
import OrderDrawer from './pages/OrderDrawer';
import OrderForms from './pages/OrderForms';
import MediaViewer from './pages/MediaViewer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
