import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './pages/App';
import AppBootstrapV5 from './pages/AppBootstrapV5';
import Auth from './pages/Auth';
import AuthV2 from './pages/AuthV2';
import Bootstrap from './pages/Bootstrap';
import ChangePassword from './pages/ChangePassword';
import Config from './pages/Config';
import CustomerManager from './pages/CustomerManager';
import Customers from './pages/Customers';
import Drawer from './pages/Drawer';
import ForceRebuild from './pages/ForceRebuild';
import Forms from './pages/Forms';
import Home from './pages/Home';
import Index from './pages/Index';
import Login from './pages/Login';
import LoginV2 from './pages/LoginV2';
import MainApp from './pages/MainApp';
import MediaViewer from './pages/MediaViewer';
import OrderDrawer from './pages/OrderDrawer';
import OrderForms from './pages/OrderForms';
import Parts from './pages/Parts';
import Password from './pages/Password';
import QR from './pages/QR';
import QRComponents from './pages/QRComponents';
import Rebuild from './pages/Rebuild';
import Settings from './pages/Settings';
import SparePartModal from './pages/SparePartModal';
import Staff from './pages/Staff';
import StaffManager from './pages/StaffManager';
import Viewer from './pages/Viewer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
        <Route path="/App" element={<App />} />
        <Route path="/AppBootstrapV5" element={<AppBootstrapV5 />} />
        <Route path="/Auth" element={<Auth />} />
        <Route path="/AuthV2" element={<AuthV2 />} />
        <Route path="/Bootstrap" element={<Bootstrap />} />
        <Route path="/ChangePassword" element={<ChangePassword />} />
        <Route path="/Config" element={<Config />} />
        <Route path="/CustomerManager" element={<CustomerManager />} />
        <Route path="/Customers" element={<Customers />} />
        <Route path="/Drawer" element={<Drawer />} />
        <Route path="/ForceRebuild" element={<ForceRebuild />} />
        <Route path="/Forms" element={<Forms />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/Index" element={<Index />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/LoginV2" element={<LoginV2 />} />
        <Route path="/MainApp" element={<MainApp />} />
        <Route path="/MediaViewer" element={<MediaViewer />} />
        <Route path="/OrderDrawer" element={<OrderDrawer />} />
        <Route path="/OrderForms" element={<OrderForms />} />
        <Route path="/Parts" element={<Parts />} />
        <Route path="/Password" element={<Password />} />
        <Route path="/QR" element={<QR />} />
        <Route path="/QRComponents" element={<QRComponents />} />
        <Route path="/Rebuild" element={<Rebuild />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/SparePartModal" element={<SparePartModal />} />
        <Route path="/Staff" element={<Staff />} />
        <Route path="/StaffManager" element={<StaffManager />} />
        <Route path="/Viewer" element={<Viewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
