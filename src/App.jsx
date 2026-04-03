import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginV2 from './pages/LoginV2';
import OrderForms from './pages/OrderForms';
import pb from './pages/pb';
import QRComponents from './pages/QRComponents';
import MainApp from './pages/MainApp';
import kiotviet from './pages/kiotviet';
import ChangePassword from './pages/ChangePassword';
import SparePartModal from './pages/SparePartModal';
import OrderDrawer from './pages/OrderDrawer';
import StaffManager from './pages/StaffManager';
import Home from './pages/Home';
import MediaViewer from './pages/MediaViewer';
import Index from './pages/Index';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
