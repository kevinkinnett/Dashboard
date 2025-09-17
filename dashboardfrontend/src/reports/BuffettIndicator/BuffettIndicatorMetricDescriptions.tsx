const cards = [
  {
    title: 'Buffett Indicator (Wilshire 5000 / GDP)',
    body: 'Total U.S. public equity market capitalization divided by U.S. economic output. Buffett called it “probably the best single measure” of aggregate equity valuation in a 2001 Fortune essay.',
  },
  {
    title: 'Rule-of-thumb bands',
    body: 'Below ~80% is often viewed as discounted, 80–120% as fair-ish, and above 120% increasingly expensive. Once valuations push toward ~200% Buffett warned investors were “playing with fire.” These are heuristics, not rigid triggers.',
  },
  {
    title: 'Global revenue vs. domestic GDP',
    body: 'Large U.S. companies sell globally, so market cap reflects worldwide opportunity while GDP is domestic. This structural shift tends to push the ratio higher over long horizons.',
  },
  {
    title: 'Measurement drift & comparability',
    body: 'Intangibles, digital goods, and the public/private mix change what both “market cap” and “GDP” capture. Ratios across decades or countries should be compared cautiously.',
  },
  {
    title: 'Inflation-adjusted S&P 500 overlay',
    body: 'The blue line deflates the S&P 500 using CPI so price moves reflect real purchasing power. Toggle the nominal line to compare headline vs. real pricing.',
  },
];

export default function BuffettIndicatorMetricDescriptions() {
  return (
    <div
      style={{
        display: 'grid',
        gap: '.75rem',
        gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
      }}
    >
      {cards.map(card => (
        <div
          key={card.title}
          style={{
            position: 'relative',
            padding: '.85rem .9rem .95rem',
            borderRadius: 'var(--radius-lg, 16px)',
            background: 'linear-gradient(145deg, rgba(30,42,56,.78), rgba(14,20,28,.88))',
            border: '1px solid var(--color-border, rgba(120,160,190,0.18))',
            color: 'var(--color-text, #d2dde7)',
            fontSize: '.7rem',
            lineHeight: 1.45,
            boxShadow: '0 2px 4px -2px rgba(0,0,0,.35)',
          }}
        >
          <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.4px', marginBottom: '.35rem', color: 'var(--color-accent, #38bdf8)' }}>
            {card.title}
          </div>
          <div>{card.body}</div>
        </div>
      ))}
    </div>
  );
}
