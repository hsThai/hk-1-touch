import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Index from './pages/Index';
import OrderForms from './pages/OrderForms';
import QRComponents from './pages/QRComponents';
import ChangePassword from './pages/ChangePassword';
import MainApp from './pages/MainApp';
import OrderDrawer from './pages/OrderDrawer';
import CustomerManager from './pages/CustomerManager';
import MediaViewer from './pages/MediaViewer';
import StaffManager from './pages/StaffManager';
import SparePartModal from './pages/SparePartModal';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Index" replace />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
