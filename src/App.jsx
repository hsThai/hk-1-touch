import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import OrderDrawer from './pages/OrderDrawer';
import StaffManager from './pages/StaffManager';
import Settings from './pages/Settings';
import QRComponents from './pages/QRComponents';
import MainApp from './pages/MainApp';
import Home from './pages/Home';
import pb from './pages/pb';
import LoginV2 from './pages/LoginV2';
import SparePartModal from './pages/SparePartModal';
import kiotviet from './pages/kiotviet';
import OrderForms from './pages/OrderForms';
import ChangePassword from './pages/ChangePassword';
import MediaViewer from './pages/MediaViewer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
