import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import OrderForms from './pages/OrderForms';
import Settings from './pages/Settings';
import OrderDrawer from './pages/OrderDrawer';
import SparePartModal from './pages/SparePartModal';
import Home from './pages/Home';
import ChangePassword from './pages/ChangePassword';
import Index from './pages/Index';
import StaffManager from './pages/StaffManager';
import MainApp from './pages/MainApp';
import MediaViewer from './pages/MediaViewer';
import QRComponents from './pages/QRComponents';
import LoginV2 from './pages/LoginV2';
import pb from './pages/pb';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/pb" element={<pb />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
