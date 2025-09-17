import { render, screen } from '@testing-library/react';
import MetricDescriptions from '../MetricDescriptions';

describe('MetricDescriptions', () => {
  test('renders the default metric set', () => {
    render(<MetricDescriptions />);

    expect(screen.getByText('About the Metrics')).toBeInTheDocument();
    expect(screen.getByText('10-Year Treasury Yield (DGS10)')).toBeInTheDocument();
    expect(screen.getByText('Yield Spread / Inversion')).toBeInTheDocument();
  });

  test('renders custom metrics when provided', () => {
    const customItems = [
      {
        title: 'Custom Metric A',
        description: 'Explanation for metric A.',
      },
      {
        title: 'Custom Metric B',
        description: 'Explanation for metric B.',
      },
    ];

    render(<MetricDescriptions items={customItems} />);

    expect(screen.getByText('Custom Metric A')).toBeInTheDocument();
    expect(screen.getByText('Explanation for metric B.')).toBeInTheDocument();
    expect(screen.queryByText('10-Year Treasury Yield (DGS10)')).not.toBeInTheDocument();
  });
});
