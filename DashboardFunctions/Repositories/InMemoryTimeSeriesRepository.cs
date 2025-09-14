using DashboardFunctions.Domain;
using System.Collections.Concurrent;

namespace DashboardFunctions.Repositories
{
    /// <summary>
    /// An in-memory, thread-safe repository that mimics SQL behavior for tests and demos.
    /// </summary>
    internal sealed class InMemoryTimeSeriesRepository : ITimeSeriesRepository
    {
        private readonly ConcurrentDictionary<(string SeriesId, DateTime Date), decimal?> _data = new();
        private readonly ConcurrentDictionary<string, List<(DateTime Start, DateTime End)>> _coverage = new();

        public Task<IReadOnlyList<(DateTime Start, DateTime End)>> GetCoverageAsync(string seriesId, CancellationToken ct)
        {
            if (_coverage.TryGetValue(seriesId, out var list))
                return Task.FromResult<IReadOnlyList<(DateTime, DateTime)>>(list.OrderBy(r => r.Start).ToList());
            return Task.FromResult<IReadOnlyList<(DateTime, DateTime)>>(Array.Empty<(DateTime, DateTime)>());
        }

        public Task UpsertObservationsAsync(IEnumerable<Observation<decimal?>> rows, CancellationToken ct)
        {
            foreach (var r in rows)
                _data[(r.SeriesId, r.Date.Date)] = r.Value;
            return Task.CompletedTask;
        }

        public Task ReplaceCoverageAsync(string seriesId, IEnumerable<(DateTime Start, DateTime End)> ranges, CancellationToken ct)
        {
            _coverage[seriesId] = ranges.Select(r => (r.Start.Date, r.End.Date)).OrderBy(r => r.Item1).ToList();
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<SeriesPoint>> GetSeriesAsync(string seriesId, DateTime start, DateTime end, CancellationToken ct)
        {
            var res = _data
                .Where(kv => kv.Key.SeriesId == seriesId && kv.Key.Date >= start.Date && kv.Key.Date <= end.Date)
                .OrderBy(kv => kv.Key.Date)
                .Select(kv => new SeriesPoint(kv.Key.Date, kv.Value))
                .ToList();

            return Task.FromResult<IReadOnlyList<SeriesPoint>>(res);
        }
    }
}
