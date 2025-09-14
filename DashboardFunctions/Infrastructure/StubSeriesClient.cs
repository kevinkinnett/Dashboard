using DashboardFunctions.Domain;

namespace DashboardFunctions.Infrastructure
{
    /// <summary>
    /// A deterministic stub data source for testing. Generates business-day values.
    /// - Uses seriesId and optional MockSeed to alter the curve.
    /// </summary>
    internal sealed class StubSeriesClient(IRequestContextAccessor rc) : ISeriesClient<decimal?>
    {
        public Task<IReadOnlyList<Observation<decimal?>>> GetObservationsAsync(
            string seriesId, DateTime start, DateTime end, CancellationToken ct)
        {
            var list = new List<Observation<decimal?>>();
            var seed = ComputeSeed(seriesId, rc.Current.MockSeed);

            for (var d = start.Date; d <= end.Date; d = d.AddDays(1))
            {
                // Only "market" days (Mon-Fri) to simulate real-world sparsity
                if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;

                var baseVal = (decimal)(2.0 + (seed % 300) / 100.0); // 2.00 .. 4.99
                var wave = (decimal)Math.Sin((d.DayOfYear + seed % 17) / 6.0) * 0.2m; // ±0.2
                var value = Math.Round(baseVal + wave, 3);
                list.Add(new Observation<decimal?>(seriesId, d, value));
            }

            return Task.FromResult<IReadOnlyList<Observation<decimal?>>>(list);
        }

        private static int ComputeSeed(string seriesId, string? extra)
        {
            var s = seriesId + "|" + (extra ?? "");
            unchecked
            {
                var h = 23;
                foreach (var c in s)
                    h = h * 31 + c;
                return Math.Abs(h);
            }
        }
    }
}
