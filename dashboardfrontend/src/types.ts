export type YieldPointDto = {
  date: string; // yyyy-MM-dd
  a: number | null;
  b: number | null;
  spread: number | null;
};

export type YieldResponseDto = {
  seriesA: string;
  seriesB: string;
  start: string;
  end: string;
  points: YieldPointDto[];
};

export type GdpGrowthPointDto = {
    date: string;                  // quarter start (e.g., 2025-04-01)
    value: number | null;          // GDPC1 level
    prev: number | null;
    change: number | null;
    changePct: number | null;      // q/q % (not fraction)
    annualizedChangePct: number | null; // q/q SAAR %
};

export type GdpGrowthResponseDto = {
    series: string;                // e.g., "GDPC1"
    start: string;
    end: string;
    frequency: 'Quarterly';
    periodsPerYear: number;        // e.g., 4
    points: GdpGrowthPointDto[];
};
