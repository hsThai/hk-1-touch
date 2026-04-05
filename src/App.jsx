import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SparePartModal from './pages/SparePartModal';
import pb from './pages/pb';
import MediaViewer from './pages/MediaViewer';
import StaffManager from './pages/StaffManager';
import Home from './pages/Home';
import LoginV2 from './pages/LoginV2';
import OrderDrawer from './pages/OrderDrawer';
import MainApp from './pages/MainApp';
import QRComponents from './pages/QRComponents';
import Settings from './pages/Settings';
import OrderForms from './pages/OrderForms';
import ChangePassword from './pages/ChangePassword';
import kiotviet from './pages/kiotviet';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/kiotviet" element={<kiotviet />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
