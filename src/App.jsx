import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginV2 from './pages/LoginV2';
import OrderDrawer from './pages/OrderDrawer';
import MainApp from './pages/MainApp';
import CustomerManager from './pages/CustomerManager';
import ForceRebuild from './pages/ForceRebuild';
import QRComponents from './pages/QRComponents';
import MediaViewer from './pages/MediaViewer';
import ChangePassword from './pages/ChangePassword';
import Settings from './pages/Settings';
import OrderForms from './pages/OrderForms';
import StaffManager from './pages/StaffManager';
import Login from './pages/Login';
import Index from './pages/Index';
import SparePartModal from './pages/SparePartModal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/LoginV2" replace />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/ForceRebuild" element={<ForceRebuild />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
