namespace DashboardFunctions.Infrastructure
{
    public sealed class SqlOptions
    {
        public string? ConnectionString { get; set; }

        // Defaults keep compatibility with the schema you’ve already created.
        public string ObservationsTableName { get; set; } = "dbo.TreasuryYieldDaily";
        public string CoverageTableName { get; set; } = "dbo.SeriesCoverage";

        // TVP types
        public string ObservationTypeName { get; set; } = "dbo.ObservationType";
        public string CoverageTypeName { get; set; } = "dbo.CoverageRangeType";

        // Stored procedures
        public string UpsertProcName { get; set; } = "dbo.UpsertTreasuryYieldDaily";
        public string ReplaceCoverageProc { get; set; } = "dbo.ReplaceCoverage";
    }

}
