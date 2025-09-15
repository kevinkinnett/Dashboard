import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJobsData } from '../../api';
import type { JobsDataResponseDto } from '../../types';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions, AgChartInstance } from 'ag-charts-community';
import JobsMetricDescriptions from './JobsMetricDescriptions';

// Stable series color mapping so toggling visibility preserves color identity
const SERIES_COLORS: Record<string, string> = {
  UNRATE: '#38bdf8', // light blue
  PAYEMS: '#f59e0b', // amber
  U6RATE: '#a78bfa', // purple
};

interface PersistedSettings { start: string; end: string; changeMode: ChangeMode; unrate: boolean; payems: boolean; u6: boolean; }

type ChangeMode = 'level' | 'pctYoY' | 'pctMoM';

const SETTINGS_KEY = 'jobsReportSettings:v5';
function loadInitial(): PersistedSettings {
  const fallback: PersistedSettings = { start: '2019-01-01', end: new Date().toISOString().slice(0,10), changeMode: 'pctYoY', unrate: true, payems: true, u6: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY); if (!raw) return fallback;
    const p = JSON.parse(raw); if (!p || typeof p !== 'object') return fallback;
    const { start, end, changeMode, unrate, payems, u6 } = p as any;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    return {
      start: iso.test(start) ? start : fallback.start,
      end: iso.test(end) ? end : fallback.end,
      changeMode: changeMode === 'pctMoM' || changeMode === 'level' ? changeMode : 'pctYoY',
      unrate: typeof unrate === 'boolean' ? unrate : true,
      payems: typeof payems === 'boolean' ? payems : true,
      u6: typeof u6 === 'boolean' ? u6 : false,
    };
  } catch { return fallback; }
}

export default function JobsReport() {
  const init = useMemo(loadInitial, []);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [changeMode, setChangeMode] = useState<ChangeMode>(init.changeMode);
  const [showUnrate, setShowUnrate] = useState<boolean>(init.unrate);
  const [showPayems, setShowPayems] = useState<boolean>(init.payems);
  const [showU6, setShowU6] = useState<boolean>(init.u6);
  const [startInput, setStartInput] = useState(init.start);
  const [endInput, setEndInput] = useState(init.end);
  const [seriesCsv, setSeriesCsv] = useState<string>('UNRATE,PAYEMS'); // derived
  const [resp, setResp] = useState<JobsDataResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Derive series list from toggles
  useEffect(() => {
    const list: string[] = [];
    if (showUnrate) list.push('UNRATE');
    if (showPayems) list.push('PAYEMS');
    if (showU6) list.push('U6RATE');
    if (!list.length) { // enforce at least one (re-add UNRATE)
      list.push('UNRATE');
      setShowUnrate(true);
    }
    setSeriesCsv(list.join(','));
  }, [showUnrate, showPayems, showU6]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq1 = window.matchMedia('(max-width: 820px)');
    const mq2 = window.matchMedia('(pointer: coarse)');
    const update = () => setIsMobile(mq1.matches || mq2.matches);
    update(); mq1.addEventListener('change', update); mq2.addEventListener('change', update);
    return () => { mq1.removeEventListener('change', update); mq2.removeEventListener('change', update); };
  }, []);

  // Persist settings
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ start, end, changeMode, unrate: showUnrate, payems: showPayems, u6: showU6 })); } catch { } }, [start, end, changeMode, showUnrate, showPayems, showU6]);

  const isValidDate = useCallback((v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v+'T00:00:00').getTime()), []);
  const maybeCommitStart = useCallback((v: string) => { if (v.length===10 && isValidDate(v)) setStart(v); }, [isValidDate]);
  const maybeCommitEnd = useCallback((v: string) => { if (v.length===10 && isValidDate(v)) setEnd(v); }, [isValidDate]);
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => { const v=e.target.value; setStartInput(v); maybeCommitStart(v); };
  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => { const v=e.target.value; setEndInput(v); maybeCommitEnd(v); };
  const handleStartBlur = () => { if (!isValidDate(startInput)) { setStartInput(start); } else setStart(startInput); };
  const handleEndBlur = () => { if (!isValidDate(endInput)) { setEndInput(end); } else setEnd(endInput); };

  const commitReload = () => setReloadToken(t=>t+1);

  useEffect(() => {
    let cancelled = false; setLoading(true); setError(null); setResp(null);
    fetchJobsData(start, end, seriesCsv).then(r => { if(!cancelled) setResp(r); })
      .catch(e => { if(!cancelled) setError(String(e)); })
      .finally(()=> { if(!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end, seriesCsv, reloadToken]);

  const isRate = (id: string) => /RATE$/i.test(id) || id.toUpperCase()==='UNRATE';

  const chartData = useMemo(() => {
    if (!resp) return [] as any[];
    // Keep original string date separate from parsed Date to avoid overwrites
    const records = resp.points.map(p => ({ ...p, rawDate: p.date, parsedDate: new Date(p.date + 'T12:00:00') }));

    if (changeMode === 'level') {
      return records.map(r => {
        const o: any = { date: r.parsedDate };
        for (const s of resp.series) o[s.property] = (r as any)[s.property] ?? null;
        return o;
      });
    }

    // Lookup map by raw date string
    const mapByDate = new Map<string, any>();
    for (const r of records) mapByDate.set(r.rawDate, r);

    function priorDateStr(parsed: Date, monthsBack: number) {
      const year = parsed.getUTCFullYear();
      const month = parsed.getUTCMonth();
      const target = new Date(Date.UTC(year, month - monthsBack, 1));
      return target.toISOString().slice(0,10);
    }

    return records.map(r => {
      const out: any = { date: r.parsedDate };
      for (const s of resp.series) {
        const raw = (r as any)[s.property] as number | null | undefined;
        if (raw == null) { out[s.property] = null; continue; }
        if (isRate(s.id)) { out[s.property] = raw; continue; }
        if (changeMode === 'pctMoM') {
          const prevKey = priorDateStr(r.parsedDate, 1);
          const prev = mapByDate.get(prevKey)?.[s.property];
          out[s.property] = (prev == null || prev === 0) ? null : ((raw - prev) / prev) * 100;
        } else if (changeMode === 'pctYoY') {
          const prevKey = priorDateStr(r.parsedDate, 12);
          const prev = mapByDate.get(prevKey)?.[s.property];
          out[s.property] = (prev == null || prev === 0) ? null : ((raw - prev) / prev) * 100;
        }
      }
      return out;
    });
  }, [resp, changeMode]);

  const rateKeys = useMemo(() => resp ? resp.series.filter(s => isRate(s.id)).map(s => s.property) : [], [resp]);
  const levelKeys = useMemo(() => resp ? resp.series.filter(s => !isRate(s.id)).map(s => s.property) : [], [resp]);

  const leftLimits = useMemo(() => {
    if (!rateKeys.length || !chartData.length) return undefined;
    const vals: number[] = [];
    for (const row of chartData) {
      for (const key of rateKeys) { const v = (row as any)[key]; if (typeof v === 'number') vals.push(v); }
    }
    if (!vals.length) return undefined;
    const min = Math.min(...vals); const max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 1;
    return { min: Math.floor((min - pad)*10)/10, max: Math.ceil((max + pad)*10)/10 };
  }, [chartData, rateKeys]);

  const seriesDefs = useMemo(() => {
    if (!resp) return [] as any[];
    return resp.series.map((s) => ({
      type: 'line',
      xKey: 'date',
      yKey: s.property,
      yName: s.id + (isRate(s.id) ? '' : changeMode === 'level' ? '' : changeMode === 'pctMoM' ? ' (MoM %)' : ' (YoY %)'),
      marker: { enabled: false },
      stroke: SERIES_COLORS[s.id.toUpperCase()] || '#60a5fa',
      strokeWidth: 2,
      interpolation: { type: 'linear' },
    }));
  }, [resp, changeMode]);

  const rightAxisTitle = useMemo(() => {
    switch (changeMode) {
      case 'pctMoM': return 'Level Series % MoM';
      case 'pctYoY': return 'Level Series % YoY';
      default: return 'Level';
    }
  }, [changeMode]);

  const chartRef = useRef<{ chart?: AgChartInstance } | null>(null);

  const options = useMemo<AgCartesianChartOptions>(() => ({
    theme: 'ag-default-dark',
    background: { fill: 'transparent' },
    data: chartData,
    title: { enabled: false },
    axes: [
      { type: 'time', position: 'bottom', label: { format: '%y', minSpacing: 8 }, nice: false, interval: { step: 'year' }, gridLine: { enabled: true } },
      { type: 'number', position: 'left', title: { text: 'Rate (%)' }, ...(leftLimits || {}), keys: rateKeys.length ? rateKeys : undefined, nice: false },
      { type: 'number', position: 'right', title: { text: rightAxisTitle }, keys: levelKeys.length ? levelKeys : undefined, nice: true, gridLine: { enabled: false } }
    ],
    legend: { enabled: true, position: isMobile ? 'top' : 'bottom', item: { marker: { size: isMobile ? 8 : 12 } } },
    series: seriesDefs,
    zoom: { enabled: true, axes: 'x', enableScrolling: true, enablePanning: true } as any,
    padding: isMobile ? { top: 4, right: 8, bottom: 2, left: 8 } : { top: 6, right: 12, bottom: 4, left: 12 },
  }), [chartData, seriesDefs, isMobile, rightAxisTitle, leftLimits, rateKeys, levelKeys]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex:1, minWidth:0, overflow:'hidden' }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'1rem', padding:'.65rem 1rem', background:'rgba(18,25,33,.85)', borderBottom:'1px solid #243241', alignItems:'flex-end' }}>
        {/* Controls */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          <label style={{ fontSize:'.6rem', textTransform:'uppercase', letterSpacing:'1px', opacity:.7 }}>Start</label>
          <input type='date' value={startInput} onChange={handleStartChange} onBlur={handleStartBlur} />
        </div>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <label style={{ fontSize:'.6rem', textTransform:'uppercase', letterSpacing:'1px', opacity:.7 }}>End</label>
          <input type='date' value={endInput} onChange={handleEndChange} onBlur={handleEndBlur} />
        </div>
        <fieldset style={{ border:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:'.25rem' }}>
          <legend style={{ fontSize:'.6rem', textTransform:'uppercase', letterSpacing:'1px', opacity:.7 }}>Series</legend>
          <label style={{ fontSize:'.6rem', display:'flex', alignItems:'center', gap:'.4rem', cursor:'pointer' }}>
            <input type='checkbox' checked={showUnrate} onChange={e=> setShowUnrate(e.target.checked)} /> UNRATE
          </label>
          <label style={{ fontSize:'.6rem', display:'flex', alignItems:'center', gap:'.4rem', cursor:'pointer' }}>
            <input type='checkbox' checked={showPayems} onChange={e=> setShowPayems(e.target.checked)} /> PAYEMS
          </label>
          <label style={{ fontSize:'.6rem', display:'flex', alignItems:'center', gap:'.4rem', cursor:'pointer' }}>
            <input type='checkbox' checked={showU6} onChange={e=> setShowU6(e.target.checked)} /> U6RATE
          </label>
        </fieldset>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <label style={{ fontSize:'.6rem', textTransform:'uppercase', letterSpacing:'1px', opacity:.7 }}>Level Series Mode</label>
          <select value={changeMode} onChange={e => setChangeMode(e.target.value as ChangeMode)} style={{ fontSize: '.65rem' }}>
            <option value='level'>Raw Level</option>
            <option value='pctMoM'>% MoM</option>
            <option value='pctYoY'>% YoY</option>
          </select>
        </div>
        <button onClick={commitReload} style={{ fontSize:'.6rem', padding:'.45rem .8rem', marginLeft:'auto' }}>Reload</button>
      </div>
      <div style={{ flex:1, minHeight:0, padding:'.75rem', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ flex:1, minHeight:0, minWidth:0, background:'linear-gradient(145deg,#1d2731,#10161c)', border:'1px solid #243241', borderRadius:12, padding:'.6rem', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:'.65rem', textTransform:'uppercase', letterSpacing:'1px', opacity:.7, marginBottom:'.4rem' }}>Labor Market Series</div>
          <div style={{ flex: '1 1 auto', minHeight:0, minWidth:0, display:'flex' }}>
            {error && <div style={{ color:'#f87171', fontSize:'.7rem' }}>{error}</div>}
            {loading && !resp && <div style={{ color:'var(--color-text-dim)', fontSize:'.7rem' }}>Loading…</div>}
            {resp && <AgCharts ref={chartRef as any} options={options as any} style={{ flex:1, minWidth:0 }} />}
          </div>
          {resp && <div style={{ fontSize:'.55rem', opacity:.6, marginTop:'.4rem' }}>Series: {resp.series.map(s=>s.id).join(', ')} | Rows: {resp.points.length} | Mode: {changeMode}</div>}
          <div style={{ marginTop:'.75rem' }}>
            <JobsMetricDescriptions seriesIds={seriesCsv.split(',').map(s=>s.trim()).filter(Boolean)} changeMode={changeMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
