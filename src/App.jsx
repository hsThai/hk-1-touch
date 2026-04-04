import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home';
import MediaViewer from './pages/MediaViewer';
import ChangePassword from './pages/ChangePassword';
import pb from './pages/pb';
import SparePartModal from './pages/SparePartModal';
import LoginV2 from './pages/LoginV2';
import OrderDrawer from './pages/OrderDrawer';
import kiotviet from './pages/kiotviet';
import OrderForms from './pages/OrderForms';
import Settings from './pages/Settings';
import QRComponents from './pages/QRComponents';
import MainApp from './pages/MainApp';
import Index from './pages/Index';
import StaffManager from './pages/StaffManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/StaffManager" element={<StaffManager />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
