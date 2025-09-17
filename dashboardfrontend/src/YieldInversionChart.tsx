// src/YieldInversionChart.tsx
import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AgChartsReact } from 'ag-charts-react';
import type { AgChartsReactRef } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import { fetchInversion, fetchGdpGrowth } from './api';
import type { YieldResponseDto, GdpGrowthResponseDto } from './types';

export interface YieldInversionChartHandle {
    resetZoom: () => void;
    saveState?: () => void;
    restoreState?: () => void;
}

interface Props {
    start: string;
    end: string;
    seriesA?: string;
    seriesB?: string;
    useSecondaryAxisForSpread?: boolean;
    reloadToken?: number; // triggers refetch when incremented
    gdpMode?: 'qoq' | 'yoy';
}

const YieldInversionChart = forwardRef<YieldInversionChartHandle, Props>(function YieldInversionChart(
    {
        start,
        end,
        seriesA = 'DGS10',
        seriesB = 'DGS2',
        useSecondaryAxisForSpread = false,
        reloadToken = 0,
        gdpMode = 'qoq'
    },
    ref
) {
    const [resp, setResp] = useState<YieldResponseDto | null>(null);
    const [error, setError] = useState<string | null>(null);

    // GDP overlay
    const [gdp, setGdp] = useState<GdpGrowthResponseDto | null>(null);

    // Track whether we consider the current device/layout as mobile
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mqCoarse = window.matchMedia('(pointer: coarse)');
        const mqNarrow = window.matchMedia('(max-width: 820px)');
        const update = () => setIsMobile(mqCoarse.matches || mqNarrow.matches);
        update();
        mqCoarse.addEventListener('change', update);
        mqNarrow.addEventListener('change', update);
        window.addEventListener('orientationchange', update);
        return () => {
            mqCoarse.removeEventListener('change', update);
            mqNarrow.removeEventListener('change', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    const agRef = useRef<AgChartsReactRef | null>(null);
    const initialStateRef = useRef<any | null>(null);
    const [resetNonce, setResetNonce] = useState(0);

    // Fetch inversion
    useEffect(() => {
        let cancelled = false;
        setError(null);
        setResp(null);
        fetchInversion(start, end, seriesA, seriesB)
            .then(r => { if (!cancelled) setResp(r); })
            .catch(e => { if (!cancelled) setError(String(e)); });
        return () => { cancelled = true; };
    }, [start, end, seriesA, seriesB, reloadToken]);

    // Fetch GDP growth with mode
    useEffect(() => {
        let cancelled = false;
        setGdp(null);
        fetchGdpGrowth(start, end, gdpMode)
            .then(r => { if (!cancelled) setGdp(r); })
            .catch(() => { if (!cancelled) setGdp(null); });
        return () => { cancelled = true; };
    }, [start, end, gdpMode, reloadToken]);

    // Capture initial chart state
    useEffect(() => {
        const inst = agRef.current?.chart;
        if (inst && typeof inst.getState === 'function') {
            try { initialStateRef.current = inst.getState(); } catch { }
        }
    }, []);

    useImperativeHandle(ref, () => ({
        resetZoom() {
            const inst = agRef.current?.chart;
            // Prefer API reset via setState if available (v9/10+)
            if (inst && typeof inst.setState === 'function') {
                const zoomState = initialStateRef.current?.zoom;
                try {
                    inst.setState(zoomState ? { zoom: zoomState } : {});
                    return;
                } catch { }
            }
            // Fallback: mutate `initialState` (runtime-applied) to full extent
            setResetNonce(n => n + 1);
        },
        // Optional helpers if you later want to persist state:
        saveState() {
            const inst = agRef.current?.chart;
            if (inst && typeof inst.getState === 'function') {
                initialStateRef.current = inst.getState();
            }
        },
        restoreState() {
            const inst = agRef.current?.chart;
            const st = initialStateRef.current;
            if (inst && typeof inst.setState === 'function' && st) {
                inst.setState(st);
            }
        },
    }), []);

    // Spread data transformation
    const data = useMemo(() => (resp?.points ?? []).map(p => {
        const date = new Date(p.date + 'T12:00:00');
        const spread = p.spread;
        return {
            date,
            a: p.a,
            b: p.b,
            spread,
            spreadPos: spread != null && spread >= 0 ? spread : null,
            spreadNeg: spread != null && spread < 0 ? spread : null,
        };
    }), [resp]);

    // GDP line uses ann % (SAAR) for qoq, plain yoy % for yoy
    const gdpLine = useMemo(() => (gdp?.points ?? []).map(p => {
        const date = new Date(p.date + 'T12:00:00');
        let v: number | null = null;
        if (gdpMode === 'qoq') {
            v = p.annualizedChangePct ?? p.changePct ?? null; // SAAR first fallback to plain q/q
        } else {
            v = p.changePct ?? null; // yoy percent
        }
        return { date, gdp: v };
    }), [gdp, gdpMode]);

    const gdpSeriesTitle = gdpMode === 'qoq' ? 'GDP (q/q SAAR %)' : 'GDP (y/y %)' ;

    const options = useMemo<AgCartesianChartOptions>(() => {
        const axes: NonNullable<AgCartesianChartOptions['axes']> = [
            {
                type: 'time',
                position: 'bottom',
                label: { format: '%Y', minSpacing: 8 },
                nice: false,
                title: { text: 'Date' },
                interval: { step: 'year' },
                gridLine: { enabled: true },
            },
            {
                type: 'number',
                position: 'left',
                title: { text: 'Yield (%)' },
                nice: false,
                crossLines: [
                    {
                        type: 'line',
                        value: 0,
                        stroke: '#ffffffb3',
                        strokeWidth: 2,
                        lineDash: [6, 4],
                    }
                ],
            },
        ];

        if (isMobile) {
            axes[0] = {
                ...axes[0],
                label: { format: '%y', minSpacing: 16 },
            } as any;
        }

        const needRightAxis = useSecondaryAxisForSpread || gdpLine.length > 0;
        if (needRightAxis) {
            axes.push({
                type: 'number',
                position: 'right',
                id: 'right',
                title: { text: gdpLine.length ? 'Spread / GDP (%)' : 'Spread (pp)' },
                nice: true,
                gridLine: { enabled: false },
            } as any);
        }

        const series: any[] = [
            {
                type: 'line', xKey: 'date', yKey: 'a', yName: resp?.seriesA ?? seriesA,
                marker: { enabled: false }, stroke: '#38bdf8', interpolation: { type: 'linear' },
            },
            {
                type: 'line', xKey: 'date', yKey: 'b', yName: resp?.seriesB ?? seriesB,
                marker: { enabled: false }, stroke: '#a78bfa', interpolation: { type: 'linear' },
            },
            {
                type: 'line', xKey: 'date', yKey: 'spreadPos', yName: 'Spread (A - B) ≥ 0',
                ...(useSecondaryAxisForSpread ? { yAxisKey: 'right' } : {}),
                marker: { enabled: false }, stroke: '#34d399', strokeWidth: 2, interpolation: { type: 'linear' },
            },
            {
                type: 'line', xKey: 'date', yKey: 'spreadNeg', yName: 'Spread (A - B) < 0',
                ...(useSecondaryAxisForSpread ? { yAxisKey: 'right' } : {}),
                marker: { enabled: false }, stroke: '#f87171', strokeWidth: 2, interpolation: { type: 'linear' },
            },
        ];

        if (gdpLine.length) {
            series.push({
                type: 'line',
                data: gdpLine,
                xKey: 'date',
                yKey: 'gdp',
                yName: gdpSeriesTitle,
                yAxisKey: 'right',
                marker: { enabled: true, size: isMobile ? 2.5 : 3 },
                stroke: '#f59e0b',
                strokeWidth: 2,
                tooltip: {
                    renderer: ({ datum }: any) => {
                        const d: Date = datum.date;
                        const y = d.getUTCFullYear();
                        const q = Math.floor(d.getUTCMonth() / 3) + 1;
                        const v = datum.gdp == null ? '—' : `${datum.gdp.toFixed(1)}%`;
                        return { title: `Q${q} ${y}`, content: `GDP growth: ${v}` };
                    },
                },
            } as any);
        }

        return {
            theme: 'ag-default-dark',
            background: { fill: 'transparent' },
            title: { enabled: false },
            subtitle: { enabled: false },
            data,
            axes,
            legend: { enabled: true, position: isMobile ? 'top' : 'bottom', item: { marker: { size: isMobile ? 8 : 12 } } },
            padding: isMobile ? { top: 4, right: 4, bottom: 2, left: 4 } : { top: 6, right: 8, bottom: 4, left: 8 },
            zoom: {
                enabled: true,
                axes: 'x',
                enableSelecting: !isMobile,
                enableScrolling: true,
                enablePanning: true,
                enableAxisDragging: !isMobile,
            } as any,
            navigator: { enabled: false } as any,
            ...(resetNonce > 0
                ? {
                    initialState: {
                        zoom: {
                            ratioX: { start: 0, end: 1 },
                            ratioY: { start: 0, end: 1 },
                        },
                    },
                }
                : {}),
            series,
        };
    }, [
        data, resp, seriesA, seriesB,
        useSecondaryAxisForSpread,
        gdpLine,
        gdpSeriesTitle,
        resetNonce,
        isMobile,
    ]);

    if (error) return <div style={{ color: '#f87171', padding: 8 }}>{error}</div>;
    if (!resp) return <div style={{ padding: 8, fontSize: '.75rem', color: 'var(--color-text-dim)' }}>Loading…</div>;

    return (
        <div style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', minHeight: 0, display: 'flex' }}>
            <AgChartsReact ref={agRef} options={options as any} style={{ flex: 1, minWidth: 0 }} />
        </div>
    );
});

export default YieldInversionChart;
