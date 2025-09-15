import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import YieldInversionChart, { type YieldInversionChartHandle } from '../../YieldInversionChart';
import MetricDescriptions from '../../MetricDescriptions';
import { purgeCache } from '../../api';

// Local storage keys specific to this report
const SETTINGS_KEY = 'yieldInversionSettings:v1';

function loadInitial() {
    const fallback = {
        start: '2019-01-01',
        end: '2025-09-01',
        seriesA: 'DGS10',
        seriesB: 'DGS2',
        secondaryAxis: false,
        gdpMode: 'qoq' as 'qoq' | 'yoy',
    };
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;
        const { start, end, seriesA, seriesB, secondaryAxis, gdpMode } = parsed as any;
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!iso.test(start) || !iso.test(end)) {
            return { ...fallback, seriesA, seriesB, secondaryAxis, gdpMode: gdpMode === 'yoy' ? 'yoy' : 'qoq' };
        }
        return {
            start,
            end,
            seriesA: seriesA || fallback.seriesA,
            seriesB: seriesB || fallback.seriesB,
            secondaryAxis: !!secondaryAxis,
            gdpMode: gdpMode === 'yoy' ? 'yoy' : 'qoq',
        };
    } catch {
        return fallback;
    }
}

export default function YieldInversionReport() {
    // Responsive detection (scoped to report)
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mqWidth = window.matchMedia('(max-width: 820px)');
        const mqCoarse = window.matchMedia('(pointer: coarse)');
        const update = () => setIsMobile(mqWidth.matches || mqCoarse.matches);
        update();
        mqWidth.addEventListener('change', update);
        mqCoarse.addEventListener('change', update);
        return () => {
            mqWidth.removeEventListener('change', update);
            mqCoarse.removeEventListener('change', update);
        };
    }, []);

    const init = useMemo(loadInitial, []);
    const initialStart = init.start;
    const initialEnd = init.end;

    const [start, setStart] = useState(init.start);
    const [end, setEnd] = useState(init.end);
    const [startInput, setStartInput] = useState(init.start);
    const [endInput, setEndInput] = useState(init.end);
    const [seriesA, setA] = useState(init.seriesA);
    const [seriesB, setB] = useState(init.seriesB);
    const [secondaryAxis, setSecondaryAxis] = useState(init.secondaryAxis);
    const [gdpMode, setGdpMode] = useState<'qoq' | 'yoy'>(init.gdpMode as 'qoq' | 'yoy');

    const [reloadToken, setReloadToken] = useState(0);
    const [purging, setPurging] = useState(false);
    const [purgeError, setPurgeError] = useState<string | null>(null);

    const chartApiRef = useRef<YieldInversionChartHandle>(null);

    useEffect(() => {
        try {
            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify({ start, end, seriesA, seriesB, secondaryAxis, gdpMode })
            );
        } catch { }
    }, [start, end, seriesA, seriesB, secondaryAxis, gdpMode]);

    const isValidDate = useCallback(
        (v: string) =>
            /^(\d{4})-(\d{2})-(\d{2})$/.test(v) &&
            !isNaN(new Date(v + 'T00:00:00').getTime()),
        []
    );

    const maybeCommitStart = useCallback(
        (v: string) => { if (v.length === 10 && isValidDate(v)) setStart(v); },
        [isValidDate]
    );

    const maybeCommitEnd = useCallback(
        (v: string) => { if (v.length === 10 && isValidDate(v)) setEnd(v); },
        [isValidDate]
    );

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value; setStartInput(v); maybeCommitStart(v);
    };
    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value; setEndInput(v); maybeCommitEnd(v);
    };

    const handleStartBlur = () => { if (!isValidDate(startInput)) { setStartInput(start); return; } setStart(startInput); };
    const handleEndBlur = () => { if (!isValidDate(endInput)) { setEndInput(end); return; } setEnd(endInput); };

    const handleKey = (
        e: React.KeyboardEvent<HTMLInputElement>,
        which: 'start' | 'end'
    ) => {
        if (e.key === 'Enter') { which === 'start' ? handleStartBlur() : handleEndBlur(); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { which === 'start' ? setStartInput(start) : setEndInput(end); (e.target as HTMLInputElement).blur(); }
    };

    const resetRange = () => { setStart(initialStart); setEnd(initialEnd); setStartInput(initialStart); setEndInput(initialEnd); };
    const resetZoom = () => { chartApiRef.current?.resetZoom(); };

    const handlePurge = async () => {
        setPurging(true); setPurgeError(null);
        try {
            await purgeCache();
            setReloadToken(t => t + 1);
            setTimeout(() => chartApiRef.current?.resetZoom(), 50);
        } catch (e: any) {
            setPurgeError(e?.message || 'Failed');
        } finally { setPurging(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '.65rem 1rem', background: 'rgba(18,25,33,.85)', borderBottom: '1px solid #243241', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Start</label>
                    <input type="date" value={startInput} onChange={handleStartChange} onBlur={handleStartBlur} onKeyDown={(e) => handleKey(e, 'start')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>End</label>
                    <input type="date" value={endInput} onChange={handleEndChange} onBlur={handleEndBlur} onKeyDown={(e) => handleKey(e, 'end')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Series A</label>
                    <input value={seriesA} onChange={(e) => setA(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Series B</label>
                    <input value={seriesB} onChange={(e) => setB(e.target.value)} />
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-end', gap: '.4rem', fontSize: '.6rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={secondaryAxis} onChange={(e) => setSecondaryAxis(e.target.checked)} /> Spread Right Axis
                </label>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>GDP Mode</label>
                    <select value={gdpMode} onChange={e => setGdpMode(e.target.value === 'yoy' ? 'yoy' : 'qoq')} style={{ fontSize: '.65rem' }}>
                        <option value="qoq">QoQ (SAAR line)</option>
                        <option value="yoy">YoY %</option>
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                    <button onClick={resetZoom} style={{ fontSize: '.6rem', padding: '.45rem .8rem' }}>Reset Zoom</button>
                    <button onClick={resetRange} style={{ fontSize: '.6rem', padding: '.45rem .8rem' }}>Reset Range</button>
                    <button onClick={handlePurge} disabled={purging} style={{ fontSize: '.6rem', padding: '.45rem .8rem', background: purging ? '#334054' : '#3d5a74', color: '#fff', border: '1px solid #4a6a86', borderRadius: 6, cursor: 'pointer' }} title="Delete cached blobs and refetch data">{purging ? 'Purging…' : 'Purge Cache'}</button>
                </div>
                {purgeError && <div style={{ width: '100%', fontSize: '.55rem', color: '#f87171' }}>{purgeError}</div>}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '.75rem', display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, minHeight: 0, minWidth: 0, background: 'linear-gradient(145deg,#1d2731,#10161c)', border: '1px solid #243241', borderRadius: 12, padding: '.6rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: isMobile ? 'auto' : 'visible' }}>
                    <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7, marginBottom: '.4rem', flex: '0 0 auto' }}>Yield Inversion</div>
                    <div style={{ flex: isMobile ? '0 0 90%' : '1 1 auto', height: isMobile ? '90%' : undefined, minHeight: 0, minWidth: 0, display: 'flex' }}>
                        <YieldInversionChart ref={chartApiRef} start={start} end={end} seriesA={seriesA} seriesB={seriesB} useSecondaryAxisForSpread={secondaryAxis} reloadToken={reloadToken} gdpMode={gdpMode} />
                    </div>
                    <div style={{ flex: '0 0 auto', marginTop: isMobile ? '.4rem' : 0 }}>
                        <MetricDescriptions />
                    </div>
                </div>
            </div>
        </div>
    );
}
