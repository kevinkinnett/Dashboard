// src/App.tsx (refactored to layout + report routing)
import React, { useState, useEffect } from 'react';
import YieldInversionReport from './reports/YieldInversion/YieldInversionReport';
import JobsReport from './reports/Jobs/JobsReport';

const NAV_KEY = 'yieldInversionSettings:navCollapsed:v1';

// Simple enum of report identifiers
const reports = [
    { id: 'yield', label: 'Yield Inversion', component: <YieldInversionReport /> },
    { id: 'jobs', label: 'Jobs', component: <JobsReport /> },
];

export default function App() {
    const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem(NAV_KEY) === '1'; } catch { return false; }
    });
    useEffect(() => { try { localStorage.setItem(NAV_KEY, navCollapsed ? '1' : '0'); } catch { } }, [navCollapsed]);

    const [activeReport, setActiveReport] = useState<string>('yield');

    const asideWidth = navCollapsed ? 54 : 230;

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
            <aside style={{ width: asideWidth, background: '#121a23', color: '#d2dde7', padding: navCollapsed ? '.65rem .4rem' : '1rem .85rem', display: 'flex', flexDirection: 'column', gap: navCollapsed ? '.5rem' : '1rem', borderRight: '1px solid #243241', flexShrink: 0, transition: 'width .25s ease', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <h1 style={{ fontSize: '1rem', margin: 0, whiteSpace: 'nowrap' }}>
                        {navCollapsed ? 'D' : 'DashOps'}
                    </h1>
                </div>
                {!navCollapsed && <div style={{ fontSize: '.7rem', opacity: 0.7 }}>Reports</div>}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                    {reports.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setActiveReport(r.id)}
                            style={{
                                textAlign: 'left',
                                background: activeReport === r.id ? '#1f2c38' : '#18222c',
                                border: '1px solid #243241',
                                color: '#c8d3dc',
                                padding: navCollapsed ? '.45rem .35rem' : '.45rem .6rem',
                                fontSize: '.6rem',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: navCollapsed ? 'center' : 'flex-start',
                                whiteSpace: 'nowrap',
                            }}
                            title={r.label}
                        >
                            {navCollapsed ? r.label[0] : r.label}
                        </button>
                    ))}
                </nav>
                <button
                    onClick={() => setNavCollapsed(c => !c)}
                    title={navCollapsed ? 'Expand' : 'Collapse'}
                    aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                    style={{ marginTop: 'auto', fontSize: '.55rem', padding: '.35rem .45rem', background: '#1e2a35', border: '1px solid #2d3c4b', color: '#c8d3dc', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.25rem' }}
                >
                    <span style={{ fontSize: '.7rem', lineHeight: 1 }}>{navCollapsed ? '»' : '«'}</span>
                    {!navCollapsed && <span>Collapse</span>}
                </button>
                {!navCollapsed && (
                    <div style={{ fontSize: '.55rem', opacity: 0.55, marginTop: '.25rem' }}>
                        v0.3 • multi-report
                    </div>
                )}
            </aside>
            <main style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {reports.find(r => r.id === activeReport)?.component}
            </main>
        </div>
    );
}
