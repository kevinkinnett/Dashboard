import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AgChartsReact } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import { fetchBuffettIndicator } from '../../api';
import type { BuffettIndicatorResponseDto } from '../../types';
import BuffettIndicatorMetricDescriptions from './BuffettIndicatorMetricDescriptions';

const SETTINGS_KEY = 'buffettIndicatorSettings:v1';

interface PersistedSettings {
  start: string;
  end: string;
  showNominal: boolean;
  showReal: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadInitial(): PersistedSettings {
  const fallback: PersistedSettings = {
    start: '1990-01-01',
    end: todayIso(),
    showNominal: false,
    showReal: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const { start, end, showNominal, showReal } = parsed as any;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    return {
      start: iso.test(start) ? start : fallback.start,
      end: iso.test(end) ? end : fallback.end,
      showNominal: typeof showNominal === 'boolean' ? showNominal : fallback.showNominal,
      showReal: typeof showReal === 'boolean' ? showReal : fallback.showReal,
    };
  } catch {
    return fallback;
  }
}

function classifyRatio(value: number | null | undefined): { label: string; tone: string } {
  if (value == null || Number.isNaN(value)) {
    return { label: 'N/A', tone: '#9ca3af' };
  }
  if (value < 80) return { label: '< 80% • historically cheap territory', tone: '#34d399' };
  if (value < 120) return { label: '80-120% • closer to long-run averages', tone: '#facc15' };
  if (value < 200) return { label: '120-200% • stretched valuations', tone: '#f97316' };
  return { label: '200%+ • “playing with fire” zone', tone: '#ef4444' };
}

export default function BuffettIndicatorReport() {
  const init = useMemo(loadInitial, []);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [startInput, setStartInput] = useState(init.start);
  const [endInput, setEndInput] = useState(init.end);
  const [showNominal, setShowNominal] = useState(init.showNominal);
  const [showReal, setShowReal] = useState(init.showReal);
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

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ start, end, showNominal, showReal })
      );
    } catch {
      /* ignore */
    }
  }, [start, end, showNominal, showReal]);

  const isValidDate = useCallback((v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + 'T00:00:00').getTime()), []);
  const maybeCommitStart = useCallback((v: string) => { if (v.length === 10 && isValidDate(v)) setStart(v); }, [isValidDate]);
  const maybeCommitEnd = useCallback((v: string) => { if (v.length === 10 && isValidDate(v)) setEnd(v); }, [isValidDate]);

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
    if (!isValidDate(startInput)) { setStartInput(start); return; }
    setStart(startInput);
  };
  const handleEndBlur = () => {
    if (!isValidDate(endInput)) { setEndInput(end); return; }
    setEnd(endInput);
  };

  const [resp, setResp] = useState<BuffettIndicatorResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBuffettIndicator(start, end)
      .then(r => { if (!cancelled) setResp(r); })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end, reloadToken]);

  const chartData = useMemo(() => {
    if (!resp) return [] as Array<Record<string, any>>;
    return resp.points.map(p => ({
      date: new Date(p.date + 'T12:00:00Z'),
      ratio: p.indicatorPercent,
      sp500: p.equityIndex,
      sp500Real: p.equityIndexReal,
    }));
  }, [resp]);

  const ratioExtent = useMemo(() => {
    const vals = chartData.map(d => d.ratio).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (!vals.length) return undefined;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = (max - min) * 0.1 || 10;
    return {
      min: Math.max(0, Math.floor((min - padding) * 10) / 10),
      max: Math.ceil((max + padding) * 10) / 10,
    };
  }, [chartData]);

  const series = useMemo(() => {
    const lines: AgCartesianChartOptions['series'] = [
      {
        type: 'line',
        xKey: 'date',
        yKey: 'ratio',
        yName: 'Buffett Indicator (%)',
        yAxisKey: 'ratioAxis',
        stroke: '#f97316',
        strokeWidth: 2.5,
        marker: { enabled: false },
        tooltip: {
          renderer: ({ datum }) => ({
            content: `Buffett Indicator: ${datum.ratio != null ? datum.ratio.toFixed(2) + '%' : 'n/a'}`,
          }),
        },
      } as any,
    ];
    if (showReal) {
      lines.push({
        type: 'line',
        xKey: 'date',
        yKey: 'sp500Real',
        yName: 'S&P 500 (real)',
        yAxisKey: 'equityAxis',
        stroke: '#60a5fa',
        strokeWidth: 2,
        marker: { enabled: false },
      } as any);
    }
    if (showNominal) {
      lines.push({
        type: 'line',
        xKey: 'date',
        yKey: 'sp500',
        yName: 'S&P 500 (nominal)',
        yAxisKey: 'equityAxis',
        stroke: '#a855f7',
        strokeWidth: 1.5,
        strokeOpacity: 0.75,
        marker: { enabled: false },
      } as any);
    }
    return lines;
  }, [showNominal, showReal]);

  const options = useMemo<AgCartesianChartOptions>(() => ({
    theme: 'ag-default-dark',
    background: { fill: 'transparent' },
    data: chartData,
    axes: [
      { type: 'time', position: 'bottom', label: { format: '%Y', minSpacing: 12 }, nice: false, gridLine: { enabled: true } },
      {
        type: 'number',
        position: 'left',
        keys: ['ratio'],
        title: { text: 'Buffett Indicator (%)' },
        nice: true,
        ...(ratioExtent || {}),
        id: 'ratioAxis',
      },
      {
        type: 'number',
        position: 'right',
        keys: ['sp500', 'sp500Real'],
        title: { text: 'S&P 500 Index' },
        nice: true,
        gridLine: { enabled: false },
        id: 'equityAxis',
      },
    ],
    legend: { enabled: true, position: isMobile ? 'top' : 'bottom', item: { marker: { size: isMobile ? 8 : 12 } } },
    series,
    zoom: { enabled: true, axes: 'x', enablePanning: true, enableScrolling: true } as any,
    padding: isMobile ? { top: 8, right: 12, bottom: 4, left: 12 } : { top: 12, right: 16, bottom: 8, left: 18 },
  }), [chartData, series, ratioExtent, isMobile]);

  const latestPoint = useMemo(() => {
    if (!resp) return null;
    for (let i = resp.points.length - 1; i >= 0; i -= 1) {
      const p = resp.points[i];
      if (p.indicatorPercent != null) return p;
    }
    return null;
  }, [resp]);

  const ratioSummary = useMemo(() => classifyRatio(latestPoint?.indicatorPercent ?? null), [latestPoint]);

  const resetRange = () => {
    const defaults = loadInitial();
    setStart(defaults.start);
    setEnd(defaults.end);
    setStartInput(defaults.start);
    setEndInput(defaults.end);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '.65rem 1rem', background: 'rgba(18,25,33,.85)', borderBottom: '1px solid #243241', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Start</label>
          <input type='date' value={startInput} onChange={handleStartChange} onBlur={handleStartBlur} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>End</label>
          <input type='date' value={endInput} onChange={handleEndChange} onBlur={handleEndBlur} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.6rem', cursor: 'pointer' }}>
          <input type='checkbox' checked={showReal} onChange={e => setShowReal(e.target.checked)} /> Show real (inflation-adjusted) S&P 500
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.6rem', cursor: 'pointer' }}>
          <input type='checkbox' checked={showNominal} onChange={e => setShowNominal(e.target.checked)} /> Show nominal S&P 500
        </label>
        <button onClick={() => setReloadToken(t => t + 1)} style={{ fontSize: '.6rem', padding: '.45rem .8rem', marginLeft: 'auto' }}>Reload</button>
        <button onClick={resetRange} style={{ fontSize: '.6rem', padding: '.45rem .8rem' }}>Reset Range</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '.75rem', display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, background: 'linear-gradient(145deg,#1d2731,#10161c)', border: '1px solid #243241', borderRadius: 12, padding: '.6rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: isMobile ? 'auto' : 'visible' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '.75rem', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
            <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Buffett Indicator vs. S&P 500</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.65rem' }}>
              <div style={{ fontSize: '.65rem', color: 'var(--color-text-dim, #9ca3af)' }}>
                Latest reading: {latestPoint ? `${latestPoint.indicatorPercent?.toFixed(2)}% (${latestPoint.date})` : '—'}
              </div>
              <div style={{ fontSize: '.65rem', color: ratioSummary.tone }}>
                {ratioSummary.label}
              </div>
            </div>
          </div>
          <div style={{ flex: isMobile ? '0 0 90%' : '1 1 auto', height: isMobile ? '90%' : undefined, minHeight: 0, minWidth: 0, display: 'flex' }}>
            {error && <div style={{ color: '#f87171', fontSize: '.7rem' }}>{error}</div>}
            {loading && !resp && <div style={{ color: 'var(--color-text-dim)', fontSize: '.7rem' }}>Loading…</div>}
            {resp && <AgChartsReact options={options as any} style={{ flex: 1, minWidth: 0 }} />}
          </div>
          <div style={{ flex: '0 0 auto', marginTop: isMobile ? '.4rem' : '.6rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {resp && (
              <div style={{ fontSize: '.6rem', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                <span>Market cap series: {resp.marketCapSeries} • GDP series: {resp.outputSeries}</span>
                <span>S&P source: {resp.equitySeries} • CPI series: {resp.priceSeries}</span>
                {resp.basePriceIndex != null && resp.basePriceIndexDate && (
                  <span>Real S&P rebased to CPI {resp.basePriceIndexDate} = {resp.basePriceIndex.toFixed(2)}</span>
                )}
              </div>
            )}
            <BuffettIndicatorMetricDescriptions />
          </div>
        </div>
      </div>
    </div>
  );
}
