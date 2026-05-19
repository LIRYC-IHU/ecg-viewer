var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var API_TARGET = (_a = process.env.VITE_API_TARGET) !== null && _a !== void 0 ? _a : 'http://127.0.0.1:3001';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: API_TARGET,
                changeOrigin: true,
            },
        },
    },
});
