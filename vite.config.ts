import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            'src': path.resolve('src'),
        }
    },
    plugins: [
        react(),
        tailwindcss()
    ],
    server: {
        port: 5175,
        allowedHosts: ["port5175.kokhan.me"],
        // Polling is required for HMR when the source is bind-mounted from the
        // Windows filesystem into the Linux container — inotify events don't
        // cross that boundary, so file watching falls back to polling.
        watch: {
            usePolling: true,
            interval: 100,
        },
    },
})
