import React from 'react';

interface MetricDescription {
    title: string;
    description: string;
}

const defaultMetrics: MetricDescription[] = [
    {
        title: '10-Year Treasury Yield (DGS10)',
        description: 'Average yield on U.S. Treasury bonds with a 10-year maturity, often viewed as a benchmark for long-term interest rates.',
    },
    {
        title: '2-Year Treasury Yield (DGS2)',
        description: 'Average yield on U.S. Treasury notes with a 2-year maturity, which tends to track expectations for near-term monetary policy.',
    },
    {
        title: 'Yield Spread / Inversion',
        description: 'The difference between the 10-year and 2-year yields. When the spread turns negative (short-term rates exceed long-term rates), the curve is said to be inverted—a pattern that has historically preceded recessions.',
    },
    {
        title: 'GDP Growth (q/q SAAR %)',
        description: 'Quarter-over-quarter change in real Gross Domestic Product, annualized and seasonally adjusted. This shows the pace of economic expansion or contraction. Future metrics may also track year-over-year changes.',
    },
];

const MetricDescriptions: React.FC<{ items?: MetricDescription[] }> = ({ items = defaultMetrics }) => (
    <div style={{ fontSize: '.75rem', marginTop: '.75rem', lineHeight: 1.4, color: 'var(--color-text-dim)' }}>
        <div
            style={{
                fontSize: '.7rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                opacity: 0.8,
                marginBottom: '.3rem',
                color: 'var(--color-text)',
            }}
        >
            About the Metrics
        </div>
        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
            {items.map((m, idx) => (
                <li key={idx} style={{ marginBottom: '.25rem' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{m.title}:</strong> {m.description}
                </li>
            ))}
        </ul>
    </div>
);

export default MetricDescriptions;
