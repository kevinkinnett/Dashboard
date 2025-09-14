namespace DashboardFunctions.Services
{
    /// <summary>
    /// Ensures the cache covers [start,end] for a given seriesId using the configured client+repo.
    /// </summary>
    public interface ITimeSeriesFetchOrchestrator
    {
        Task EnsureCachedAsync(string seriesId, DateTime start, DateTime end, CancellationToken ct);
    }
}
