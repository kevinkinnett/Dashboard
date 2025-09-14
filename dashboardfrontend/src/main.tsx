import ReactDOM from 'react-dom/client';

// Import Enterprise *before* any charts render
import 'ag-charts-enterprise';
import { LicenseManager } from 'ag-charts-enterprise';

// Set license if provided (optional)
try {
    const key = (import.meta as any).env?.VITE_AGCHARTS_LICENSE_KEY;
    if (key) LicenseManager.setLicenseKey(key);
} catch { }

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
);
