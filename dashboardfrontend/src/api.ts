import type { YieldResponseDto } from './types';
import type { GdpGrowthResponseDto } from './types';

export async function fetchInversion(
  start: string,
  end: string,
  seriesA = 'DGS10',
  seriesB = 'DGS2'
): Promise<YieldResponseDto> {
  const base = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '');
  if (!base) {
    console.error('VITE_API_BASE missing. Current import.meta.env:', (import.meta as any).env);
    throw new Error('VITE_API_BASE not configured');
  }
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
    const base = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '');
    if (!base) throw new Error('VITE_API_BASE not configured');
    const url = `${base}/api/gdp-growth?start=${start}&end=${end}`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return (await res.json()) as GdpGrowthResponseDto;
}
