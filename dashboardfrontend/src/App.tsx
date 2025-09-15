// src/App.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import YieldInversionChart, { type YieldInversionChartHandle } from './YieldInversionChart';
import MetricDescriptions from './MetricDescriptions';
import { purgeCache } from './api';

const STORAGE_KEY = 'yieldInversionSettings:v1';
const NAV_KEY = 'yieldInversionSettings:navCollapsed:v1';

function loadInitial() {
    const fallback = {
        start: '2019-01-01',
        end: '2025-09-01',
        seriesA: 'DGS10',
        seriesB: 'DGS2',
        secondaryAxis: false,
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;
        const { start, end, seriesA, seriesB, secondaryAxis } = parsed as any;
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!iso.test(start) || !iso.test(end)) {
            return { ...fallback, seriesA, seriesB, secondaryAxis };
        }
        return {
            start,
            end,
            seriesA: seriesA || fallback.seriesA,
            seriesB: seriesB || fallback.seriesB,
            secondaryAxis: !!secondaryAxis,
        };
    } catch {
        return fallback;
    }
}

export default function App() {
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

    // Chart reload token (increments after cache purge)
    const [reloadToken, setReloadToken] = useState(0);
    const [purging, setPurging] = useState(false);
    const [purgeError, setPurgeError] = useState<string | null>(null);

    // Collapsible nav state (persisted)
    const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem(NAV_KEY) === '1'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem(NAV_KEY, navCollapsed ? '1' : '0'); } catch {}
    }, [navCollapsed]);

    const chartApiRef = useRef<YieldInversionChartHandle>(null);

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ start, end, seriesA, seriesB, secondaryAxis })
            );
        } catch { }
    }, [start, end, seriesA, seriesB, secondaryAxis]);

    const isValidDate = useCallback(
        (v: string) =>
            /^(\d{4})-(\d{2})-(\d{2})$/.test(v) &&
            !isNaN(new Date(v + 'T00:00:00').getTime()),
        []
    );

    const maybeCommitStart = useCallback(
        (v: string) => {
            if (v.length === 10 && isValidDate(v)) setStart(v);
        },
        [isValidDate]
    );

    const maybeCommitEnd = useCallback(
        (v: string) => {
            if (v.length === 10 && isValidDate(v)) setEnd(v);
        },
        [isValidDate]
    );

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setStartInput(v);
        maybeCommitStart(v);
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setEndInput(v);
        maybeCommitEnd(v);
    };

    const handleStartBlur = () => {
        if (!isValidDate(startInput)) {
            setStartInput(start);
            return;
        }
        setStart(startInput);
    };

    const handleEndBlur = () => {
        if (!isValidDate(endInput)) {
            setEndInput(end);
            return;
        }
        setEnd(endInput);
    };

    const handleKey = (
        e: React.KeyboardEvent<HTMLInputElement>,
        which: 'start' | 'end'
    ) => {
        if (e.key === 'Enter') {
            which === 'start' ? handleStartBlur() : handleEndBlur();
            (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
            which === 'start' ? setStartInput(start) : setEndInput(end);
            (e.target as HTMLInputElement).blur();
        }
    };

    const resetRange = () => {
        setStart(initialStart);
        setEnd(initialEnd);
        setStartInput(initialStart);
        setEndInput(initialEnd);
    };

    const resetZoom = () => {
        chartApiRef.current?.resetZoom();
    };

    const handlePurge = async () => {
        setPurging(true);
        setPurgeError(null);
        try {
            await purgeCache();
            setReloadToken(t => t + 1);
            setTimeout(() => chartApiRef.current?.resetZoom(), 50);
        } catch (e: any) {
            setPurgeError(e.message || 'Failed');
        } finally {
            setPurging(false);
        }
    };

    const asideWidth = navCollapsed ? 54 : 230;

    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                width: '100%',
                fontFamily: 'system-ui, sans-serif',
                overflow: 'hidden',
            }}
        >
            <aside
                style={{
                    width: asideWidth,
                    background: '#121a23',
                    color: '#d2dde7',
                    padding: navCollapsed ? '.65rem .4rem' : '1rem .85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: navCollapsed ? '.5rem' : '1rem',
                    borderRight: '1px solid #243241',
                    flexShrink: 0,
                    transition: 'width .25s ease',
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <h1 style={{ fontSize: '1rem', margin: 0, whiteSpace: 'nowrap' }}>
                        {navCollapsed ? 'D' : 'DashOps'}
                    </h1>
                </div>
                {!navCollapsed && (
                    <div style={{ fontSize: '.7rem', opacity: 0.7 }}>Yield Inversion</div>
                )}
                <button
                    onClick={() => setNavCollapsed(c => !c)}
                    title={navCollapsed ? 'Expand' : 'Collapse'}
                    aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                    style={{
                        marginTop: 'auto',
                        fontSize: '.55rem',
                        padding: '.35rem .45rem',
                        background: '#1e2a35',
                        border: '1px solid #2d3c4b',
                        color: '#c8d3dc',
                        cursor: 'pointer',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '.25rem',
                    }}
                >
                    <span style={{ fontSize: '.7rem', lineHeight: 1 }}>
                        {navCollapsed ? '»' : '«'}
                    </span>
                    {!navCollapsed && <span>Collapse</span>}
                </button>
                {!navCollapsed && (
                    <div style={{ fontSize: '.55rem', opacity: 0.55, marginTop: '.25rem' }}>
                        v0.2 • enterprise zoom
                    </div>
                )}
            </aside>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        padding: '.65rem 1rem',
                        background: 'rgba(18,25,33,.85)',
                        borderBottom: '1px solid #243241',
                        alignItems: 'flex-end'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                            style={{
                                fontSize: '.6rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                opacity: 0.7,
                            }}
                        >
                            Start
                        </label>
                        <input
                            type="date"
                            value={startInput}
                            onChange={handleStartChange}
                            onBlur={handleStartBlur}
                            onKeyDown={(e) => handleKey(e, 'start')}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                            style={{
                                fontSize: '.6rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                opacity: 0.7,
                            }}
                        >
                            End
                        </label>
                        <input
                            type="date"
                            value={endInput}
                            onChange={handleEndChange}
                            onBlur={handleEndBlur}
                            onKeyDown={(e) => handleKey(e, 'end')}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                            style={{
                                fontSize: '.6rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                opacity: 0.7,
                            }}
                        >
                            Series A
                        </label>
                        <input value={seriesA} onChange={(e) => setA(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                            style={{
                                fontSize: '.6rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                opacity: 0.7,
                            }}
                        >
                            Series B
                        </label>
                        <input value={seriesB} onChange={(e) => setB(e.target.value)} />
                    </div>

                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '.4rem',
                            fontSize: '.6rem',
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={secondaryAxis}
                            onChange={(e) => setSecondaryAxis(e.target.checked)}
                        />{' '}
                        Spread Right Axis
                    </label>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                        <button
                            onClick={resetZoom}
                            style={{ fontSize: '.6rem', padding: '.45rem .8rem' }}
                        >
                            Reset Zoom
                        </button>
                        <button
                            onClick={resetRange}
                            style={{ fontSize: '.6rem', padding: '.45rem .8rem' }}
                        >
                            Reset Range
                        </button>
                        <button
                            onClick={handlePurge}
                            disabled={purging}
                            style={{ fontSize: '.6rem', padding: '.45rem .8rem', background: purging ? '#334054' : '#3d5a74', color: '#fff', border: '1px solid #4a6a86', borderRadius: 6, cursor: 'pointer' }}
                            title="Delete cached blobs and refetch data"
                        >
                            {purging ? 'Purging…' : 'Purge Cache'}
                        </button>
                    </div>
                    {purgeError && (
                        <div style={{ width: '100%', fontSize: '.55rem', color: '#f87171' }}>
                            {purgeError}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        padding: '.75rem',
                        display: 'flex',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            minWidth: 0,
                            background: 'linear-gradient(145deg,#1d2731,#10161c)',
                            border: '1px solid #243241',
                            borderRadius: 12,
                            padding: '.6rem',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                opacity: 0.7,
                                marginBottom: '.4rem',
                            }}
                        >
                            Yield Inversion
                        </div>
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                minWidth: 0,
                                display: 'flex',
                            }}
                        >
                            <YieldInversionChart
                                ref={chartApiRef}
                                start={start}
                                end={end}
                                seriesA={seriesA}
                                seriesB={seriesB}
                                useSecondaryAxisForSpread={secondaryAxis}
                                reloadToken={reloadToken}
                            />
                        </div>
                        <MetricDescriptions />
                    </div>
                </div>
            </div>
        </div>
    );
}
