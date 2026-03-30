import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MediaViewer from './pages/MediaViewer';
import OrderForms from './pages/OrderForms';
import OrderDrawer from './pages/OrderDrawer';
import Index from './pages/Index';
import Settings from './pages/Settings';
import QRComponents from './pages/QRComponents';
import Login from './pages/Login';
import CustomerManager from './pages/CustomerManager';
import SparePartModal from './pages/SparePartModal';
import StaffManager from './pages/StaffManager';
import ChangePassword from './pages/ChangePassword';
import MainApp from './pages/MainApp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/MediaViewer" replace />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/MainApp" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
