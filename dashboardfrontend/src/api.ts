import type { YieldResponseDto, GdpGrowthResponseDto, JobsDataResponseDto } from './types';

interface EnvShape { VITE_API_BASE?: string; VITE_API_KEY?: string; }
function getEnv(): EnvShape {
  // Populated in main.tsx
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ENV) {
    return (globalThis as any).__ENV as EnvShape;
  }
  return {};
}

function resolveApiBase(): string {
  const raw = getEnv().VITE_API_BASE;
  if (!raw || !raw.trim()) return '';
  return raw.replace(/\/$/, '');
}

function appendCode(url: string): string {
  const key = getEnv().VITE_API_KEY;
  if (!key) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}code=${encodeURIComponent(key)}`;
}

export async function fetchInversion(
  start: string,
  end: string,
  seriesA = 'DGS10',
  seriesB = 'DGS2'
): Promise<YieldResponseDto> {
  const base = resolveApiBase();
  const url = appendCode(`${base}/api/yield-inversion?start=${start}&end=${end}&seriesA=${seriesA}&seriesB=${seriesB}`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as YieldResponseDto;
}

export async function fetchGdpGrowth(
  start: string,
  end: string,
  mode: 'qoq' | 'yoy' = 'qoq'
): Promise<GdpGrowthResponseDto> {
  const base = resolveApiBase();
  const url = appendCode(`${base}/api/gdp-growth?start=${start}&end=${end}&mode=${mode}`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as GdpGrowthResponseDto;
}

export async function fetchJobsData(
  start: string,
  end: string,
  seriesCsv?: string
): Promise<JobsDataResponseDto> {
  const base = resolveApiBase();
  const params = new URLSearchParams({ start, end });
  if (seriesCsv && seriesCsv.trim()) params.set('series', seriesCsv.trim());
  const url = appendCode(`${base}/api/jobs-data?${params.toString()}`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return await res.json() as JobsDataResponseDto;
}

// DELETE selected cache blobs (coverage + specified observation blobs)
export async function purgeCache(): Promise<{ message: string } & Record<string, any>> {
  const base = resolveApiBase();
  const url = appendCode(`${base}/api/yield`);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return await res.json();
}
