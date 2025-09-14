using DashboardFunctions.Domain;
using DashboardFunctions.Infrastructure;
using DashboardFunctions.Repositories;

namespace DashboardFunctions.Services
{
    /// <summary>
    /// Generic orchestrator for numeric daily time-series: compute coverage gaps, fetch, upsert, update coverage.
    /// Reusable with any ISeriesClient<decimal?> and ITimeSeriesRepository.
    /// </summary>
    internal sealed class TimeSeriesFetchOrchestrator(
        ISeriesClientFactory<decimal?> clientFactory,
        ITimeSeriesRepositoryFactory repoFactory,
        IRangeService ranges) : ITimeSeriesFetchOrchestrator
    {
        public async Task EnsureCachedAsync(string seriesId, DateTime start, DateTime end, CancellationToken ct)
        {
            var client = clientFactory.Resolve();
            var repo = repoFactory.Resolve();

            var target = new DateRange(start.Date, end.Date).Normalize();
            var coverage = await repo.GetCoverageAsync(seriesId, ct);
            var coveredRanges = coverage.Select(c => new DateRange(c.Start, c.End));
            var gaps = ranges.Complement(target, coveredRanges);

            if (gaps.Count == 0) return;

            var fetched = new List<DateRange>();
            foreach (var gap in gaps)
            {
                var obs = await client.GetObservationsAsync(seriesId, gap.Start, gap.End, ct);
                await repo.UpsertObservationsAsync(obs, ct);
                fetched.Add(gap);
            }

            var newCoverage = ranges.Coalesce(coveredRanges.Concat(fetched));
            await repo.ReplaceCoverageAsync(seriesId, newCoverage.Select(r => (r.Start, r.End)), ct);
        }
    }
}
