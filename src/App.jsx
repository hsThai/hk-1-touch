import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChangePassword from './pages/ChangePassword';
import SparePartModal from './pages/SparePartModal';
import Index from './pages/Index';
import Home from './pages/Home';
import MainApp from './pages/MainApp';
import LoginV2 from './pages/LoginV2';
import pb from './pages/pb';
import OrderDrawer from './pages/OrderDrawer';
import kiotviet from './pages/kiotviet';
import OrderForms from './pages/OrderForms';
import StaffManager from './pages/StaffManager';
import MediaViewer from './pages/MediaViewer';
import QRComponents from './pages/QRComponents';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/Settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
