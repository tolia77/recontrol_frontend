import {BrowserRouter, Route, Routes} from "react-router";
import Layout from "./components/Layout.tsx";
import Index from "src/pages/Index.tsx";

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout/>}>
                        <Route index element={<Index/>}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App
