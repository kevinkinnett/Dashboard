import ReactDOM from 'react-dom/client';

// Import Enterprise *before* any charts render
import 'ag-charts-enterprise';
import { LicenseManager } from 'ag-charts-enterprise';

// Set license if provided (optional)
try {
    const key = (import.meta as any).env?.VITE_AGCHARTS_LICENSE_KEY;
    if (key) LicenseManager.setLicenseKey(key);
} catch { }

// Expose selected env vars for code that avoids direct import.meta usage
try {
    (globalThis as any).__ENV = {
        VITE_API_BASE: (import.meta as any).env?.VITE_API_BASE || '',
        VITE_API_KEY: (import.meta as any).env?.VITE_API_KEY || ''
    };
} catch { }

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
);
