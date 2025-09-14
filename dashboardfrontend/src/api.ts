import type { YieldResponseDto, GdpGrowthResponseDto } from './types';

// Helper to resolve the API base.
// In Azure Static Web Apps, the frontend and Functions share the same origin and
// functions are automatically exposed under the /api route. Therefore we can
// default to '' (same-origin) and only require VITE_API_BASE for local dev overrides
// (e.g. VITE_API_BASE=http://localhost:7071).
function resolveApiBase(): string {
  const raw = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (!raw || !raw.trim()) return '';
  return raw.replace(/\/$/, '');
}

export async function fetchInversion(
  start: string,
  end: string,
  seriesA = 'DGS10',
  seriesB = 'DGS2'
): Promise<YieldResponseDto> {
  const base = resolveApiBase();
  const url = `${base}/api/yield-inversion?start=${start}&end=${end}&seriesA=${seriesA}&seriesB=${seriesB}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as YieldResponseDto;
}

export async function fetchGdpGrowth(
  start: string,
  end: string
): Promise<GdpGrowthResponseDto> {
  const base = resolveApiBase();
  const url = `${base}/api/gdp-growth?start=${start}&end=${end}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as GdpGrowthResponseDto;
}
