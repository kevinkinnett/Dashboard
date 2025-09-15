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
        description: 'Quarter-over-quarter change in real Gross Domestic Product, annualized and seasonally adjusted. QoQ SAAR takes the single quarter growth rate and annualizes it (showing the pace if that quarter repeated all year), making it more volatile and earlier turning. YoY growth compares a quarter to the same quarter a year earlier—smoother, but slower to reflect turning points. You can toggle between these modes above.',
    },
];

interface Props { items?: MetricDescription[] }

function MetricDescriptions({ items = defaultMetrics }: Props) {
    return (
        <div
            style={{
                fontSize: '.8rem',
                marginTop: '.75rem',
                lineHeight: 1.45,
                color: 'var(--color-text, #d2dde7)',
            }}
        >
            <div
                style={{
                    fontSize: '.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    opacity: 0.85,
                    marginBottom: '.55rem',
                    color: 'var(--color-text-dim, #7b91a8)',
                    fontWeight: 600,
                }}
            >
                About the Metrics
            </div>
            <div
                style={{
                    display: 'grid',
                    gap: '.75rem',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                }}
            >
                {items.map((m, idx) => (
                    <div
                        key={idx}
                        style={{
                            position: 'relative',
                            padding: '.85rem .9rem .95rem',
                            borderRadius: 'var(--radius-lg, 16px)',
                            background:
                                'linear-gradient(145deg, rgba(30,42,56,.78), rgba(14,20,28,.88))',
                            border: '1px solid var(--color-border, rgba(120,160,190,0.18))',
                            backdropFilter: 'blur(10px) saturate(160%)',
                            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                            boxShadow:
                                '0 2px 4px -2px rgba(0,0,0,.4), 0 6px 18px -6px rgba(0,0,0,.55)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '.35rem',
                            transition: 'border-color .25s, transform .25s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-accent, #00d1ff)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border, rgba(120,160,190,0.18))';
                            e.currentTarget.style.transform = 'none';
                        }}
                    >
                        <div
                            style={{
                                fontSize: '.7rem',
                                fontWeight: 600,
                                letterSpacing: '.5px',
                                color: 'var(--color-accent, #00d1ff)',
                                textShadow: '0 0 4px rgba(0,209,255,.35)',
                            }}
                        >
                            {m.title}
                        </div>
                        <div style={{ fontSize: '.72rem', color: 'var(--color-text, #d2dde7)' }}>{m.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default MetricDescriptions;
