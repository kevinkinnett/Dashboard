using DashboardFunctions.Domain;

namespace DashboardFunctions.Infrastructure
{
    /// <summary>
    /// Fetches an external numeric (decimal?) daily time-series for a given seriesId in [start,end].
    /// </summary>
    public interface ISeriesClient<T>
    {
        Task<IReadOnlyList<Observation<T>>> GetObservationsAsync(
            string seriesId, DateTime start, DateTime end, CancellationToken ct);
    }
}
