import {BrowserRouter, Route, Routes} from "react-router";
import Layout from "src/components/Layout.tsx";
import Index from "src/pages/Index.tsx";
import Login from "src/pages/Login.tsx";
import Signup from "src/pages/Signup.tsx";

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout/>}>
                        <Route index element={<Index/>}/>
                        <Route path="/login" element={<Login/>}/>
                        <Route path="/signup" element={<Signup/>}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App
