import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import WarehouseManager from './pages/WarehouseManager';
import OrderDrawer from './pages/OrderDrawer';
import kiotviet from './pages/kiotviet';
import MainApp from './pages/MainApp';
import HandoverModal from './pages/HandoverModal';
import QRComponents from './pages/QRComponents';
import SparePartModal from './pages/SparePartModal';
import PreCheckModal from './pages/PreCheckModal';
import OrderForms from './pages/OrderForms';
import Settings from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import StockExportFlow from './pages/StockExportFlow';
import LoginV2 from './pages/LoginV2';
import OrderPublic from './pages/OrderPublic';
import Home from './pages/Home';
import MediaViewer from './pages/MediaViewer';
import pb from './pages/pb';
import StaffManager from './pages/StaffManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/WarehouseManager" element={<WarehouseManager />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/kiotviet" element={<kiotviet />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/HandoverModal" element={<HandoverModal />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/PreCheckModal" element={<PreCheckModal />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/StockExportFlow" element={<StockExportFlow />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/OrderPublic" element={<OrderPublic />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/pb" element={<pb />} />
        <Route path="/StaffManager" element={<StaffManager />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
