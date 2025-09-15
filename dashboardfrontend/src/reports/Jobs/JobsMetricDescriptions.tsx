import React from 'react';
import MetricDescriptions from '../../MetricDescriptions';

// Map of common labor market FRED series -> { title, description }
const INFO: Record<string, { title: string; description: string }> = {
  UNRATE: {
    title: 'Unemployment Rate (UNRATE)',
    description: 'Percentage of the civilian labor force that is unemployed (seasonally adjusted). A coincident / slightly lagging indicator of labor slack.'
  },
  PAYEMS: {
    title: 'Nonfarm Payroll Employment (PAYEMS)',
    description: 'Total number of paid U.S. nonfarm workers (thousands, seasonally adjusted). A broad measure of job creation; monthly change shows labor demand strength.'
  },
  JTSJOL: {
    title: 'Job Openings (JTSJOL)',
    description: 'Total number of job openings at the end of the month from the JOLTS survey. High openings relative to unemployment imply tight labor conditions.'
  },
  JTSHIR: {
    title: 'Hires (JTSHIR)',
    description: 'Number of hires during the month (JOLTS). Helps assess churn and underlying demand beyond openings.'
  },
  JTSQUR: {
    title: 'Quits (JTSQUR)',
    description: 'Number of voluntary separations (quits). Elevated quits typically signal worker confidence and tight labor markets.'
  },
  CIVPART: {
    title: 'Labor Force Participation (CIVPART)',
    description: 'Share of the civilian noninstitutional population either employed or actively seeking work. Structural participation shifts influence potential employment growth.'
  },
  EMRATIO: {
    title: 'Employment-Population Ratio (EMRATIO)',
    description: 'Employed persons as a percent of the civilian noninstitutional population. Complements unemployment rate by capturing participation changes.'
  },
  U6RATE: {
    title: 'U-6 Underemployment Rate (U6RATE)',
    description: 'Broadest unemployment definition including unemployed, plus marginally attached workers and those working part-time for economic reasons. Typically sits several points above headline UNRATE and widens more in downturns.'
  }
};

export interface JobsMetricDescriptionsProps {
  seriesIds: string[];        // FRED ids currently plotted
  changeMode: 'level' | 'pctMoM' | 'pctYoY';
}

function JobsMetricDescriptions({ seriesIds, changeMode }: JobsMetricDescriptionsProps) {
  // Build list honoring user’s selected series. Provide graceful fallback text.
  const items = seriesIds.map(id => {
    const upper = id.toUpperCase();
    const meta = INFO[upper];
    if (meta) {
      // If transformed into percent changes, append note.
      let desc = meta.description;
      if (changeMode !== 'level' && upper !== 'UNRATE' && !/RATE$/i.test(upper)) {
        desc += changeMode === 'pctMoM'
          ? ' (Displaying month-over-month percent change.)'
          : ' (Displaying year-over-year percent change.)';
      }
      return { title: meta.title, description: desc };
    }
    return {
      title: `${id}`,
      description: changeMode === 'level'
        ? 'Series displayed in original units.'
        : `Series displayed as ${changeMode === 'pctMoM' ? 'month-over-month' : 'year-over-year'} percent change.`
    };
  });

  return <MetricDescriptions items={items} />;
}

export default JobsMetricDescriptions;
