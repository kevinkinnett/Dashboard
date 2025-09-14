namespace DashboardFunctions.Infrastructure
{
    public sealed class StorageCacheOptions
    {
        public string? ConnectionString { get; set; }
        public string ContainerName { get; set; } = "cache";
        public string ObservationsBlobName { get; set; } = "observations.csv";
        public string CoverageBlobName { get; set; } = "coverage.csv";
    }
}
