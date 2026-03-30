import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import StaffManager from './pages/StaffManager';
import QRComponents from './pages/QRComponents';
import ChangePassword from './pages/ChangePassword';
import OrderDrawer from './pages/OrderDrawer';
import Settings from './pages/Settings';
import OrderForms from './pages/OrderForms';
import Login from './pages/Login';
import Index from './pages/Index';
import MainApp from './pages/MainApp';
import SparePartModal from './pages/SparePartModal';
import MediaViewer from './pages/MediaViewer';
import CustomerManager from './pages/CustomerManager';
import ForceRebuild from './pages/ForceRebuild';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/StaffManager" replace />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/ForceRebuild" element={<ForceRebuild />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
