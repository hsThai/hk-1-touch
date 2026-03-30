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
import AppBootstrapV5 from './pages/AppBootstrapV5';
import App from './pages/App';
import Forms from './pages/Forms';
import Drawer from './pages/Drawer';
import Viewer from './pages/Viewer';
import QR from './pages/QR';
import Staff from './pages/Staff';
import Config from './pages/Config';
import Password from './pages/Password';
import Auth from './pages/Auth';
import AuthV2 from './pages/AuthV2';
import Home from './pages/Home';
import Customers from './pages/Customers';
import Parts from './pages/Parts';
import Rebuild from './pages/Rebuild';
import Bootstrap from './pages/Bootstrap';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/Home" replace />} />
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
        <Route path="/AppBootstrapV5" element={<AppBootstrapV5 />} />
        <Route path="/App" element={<App />} />
        <Route path="/Forms" element={<Forms />} />
        <Route path="/Drawer" element={<Drawer />} />
        <Route path="/Viewer" element={<Viewer />} />
        <Route path="/QR" element={<QR />} />
        <Route path="/Staff" element={<Staff />} />
        <Route path="/Config" element={<Config />} />
        <Route path="/Password" element={<Password />} />
        <Route path="/Auth" element={<Auth />} />
        <Route path="/AuthV2" element={<AuthV2 />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/Customers" element={<Customers />} />
        <Route path="/Parts" element={<Parts />} />
        <Route path="/Rebuild" element={<Rebuild />} />
        <Route path="/Bootstrap" element={<Bootstrap />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
