using DashboardFunctions.Domain;

namespace DashboardFunctions.Repositories
{
    /// <summary>
    /// Numeric (decimal?) daily time-series cache + coverage repository.
    /// Backed by SQL with TVP bulk upserts.
    /// </summary>
    public interface ITimeSeriesRepository
    {
        Task<IReadOnlyList<(DateTime Start, DateTime End)>> GetCoverageAsync(string seriesId, CancellationToken ct);

        Task UpsertObservationsAsync(IEnumerable<Observation<decimal?>> rows, CancellationToken ct);

        Task ReplaceCoverageAsync(string seriesId, IEnumerable<(DateTime Start, DateTime End)> ranges, CancellationToken ct);

        Task<IReadOnlyList<SeriesPoint>> GetSeriesAsync(string seriesId, DateTime start, DateTime end, CancellationToken ct);
    }
}
