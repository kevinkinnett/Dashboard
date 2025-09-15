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
    prev: number | null;           // comparison value (prior quarter for qoq, same quarter prior year for yoy)
    change: number | null;         // absolute change vs prev
    changePct: number | null;      // percent change vs prev (q/q or y/y)
    annualizedChangePct: number | null; // only populated for qoq mode (SAAR); null for yoy
};

export type GdpGrowthResponseDto = {
    series: string;                // e.g., "GDPC1"
    start: string;
    end: string;
    frequency: 'Quarterly';
    periodsPerYear: number;        // e.g., 4
    mode: 'qoq' | 'yoy';           // calculation mode returned by API
    points: GdpGrowthPointDto[];
};

// Jobs (labor market) multi-series endpoint
export type JobsSeriesMeta = { id: string; property: string }; // property is key in each point
export type JobsPointDto = { date: string } & Record<string, number | null>; // dynamic series columns
export type JobsDataResponseDto = {
  start: string;
  end: string;
  series: JobsSeriesMeta[];
  points: JobsPointDto[];
};
