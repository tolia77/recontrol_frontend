import {BrowserRouter, Route, Routes} from "react-router";
import Layout from "src/components/Layout.tsx";
import Index from "src/pages/Index.tsx";
import Login from "src/pages/Login.tsx";
import Signup from "src/pages/Signup.tsx";
import {DeviceControl} from "src/pages/DeviceControl/DeviceControl.tsx";
import Dashboard from "src/pages/Dashboard.tsx";
import Devices from "src/pages/Devices/Devices.tsx";
import DeviceSettings from "src/pages/DeviceSettings.tsx";
import Help from "src/pages/Help.tsx";
import UserSettings from "src/pages/UserSettings.tsx";
import AdminUsers from "src/pages/AdminUsers.tsx";

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    {/* Public landing page without sidebar */}
                    <Route path="/" element={<Index/>}/>

                    {/* App pages with sidebar layout */}
                    <Route element={<Layout/>}>
                        <Route path="/dashboard" element={<Dashboard/>}/>
                        <Route path="/devices" element={<Devices/>}/>
                        <Route path="/devices/:deviceId/settings" element={<DeviceSettings />} />
                        <Route path="/settings" element={<UserSettings/>} />
                        <Route path="/admin/users" element={<AdminUsers/>}/>
                    </Route>
                    <Route path="/help" element={<Help/>} />

                    {/* Auth and utilities */}
                    <Route path="/login" element={<Login/>}/>
                    <Route path="/signup" element={<Signup/>}/>
                    <Route path="/device-control" element={<DeviceControl wsUrl={import.meta.env.VITE_WEBSOCKETS_URL}/>}/>

                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App
