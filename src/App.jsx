import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChangePassword from './pages/ChangePassword';
import Home from './pages/Home';
import LoginV2 from './pages/LoginV2';
import MainApp from './pages/MainApp';
import MediaViewer from './pages/MediaViewer';
import OrderDrawer from './pages/OrderDrawer';
import OrderForms from './pages/OrderForms';
import OrderPublic from './pages/OrderPublic';
import QRComponents from './pages/QRComponents';
import Settings from './pages/Settings';
import SparePartModal from './pages/SparePartModal';
import StaffManager from './pages/StaffManager';
import StockExportFlow from './pages/StockExportFlow';
import kiotviet from './pages/kiotviet';
import pb from './pages/pb';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/OrderPublic" element={<OrderPublic />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/StockExportFlow" element={<StockExportFlow />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/pb" element={<pb />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
