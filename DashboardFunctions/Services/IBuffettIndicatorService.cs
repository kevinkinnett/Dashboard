namespace DashboardFunctions.Services
{
    using DashboardFunctions.Domain;

    public interface IBuffettIndicatorService
    {
        BuffettIndicatorResult Compute(
            IEnumerable<SeriesPoint> marketCap,
            IEnumerable<SeriesPoint> economicOutput,
            IEnumerable<SeriesPoint> equityIndex,
            IEnumerable<SeriesPoint> priceIndex,
            DateTime start,
            DateTime end);
    }

    public sealed record BuffettIndicatorResult(
        IReadOnlyList<BuffettIndicatorPoint> Points,
        decimal? BasePriceIndex,
        DateTime? BasePriceIndexDate);

    public sealed record BuffettIndicatorPoint(
        DateTime Date,
        decimal? MarketCap,
        decimal? EconomicOutput,
        decimal? IndicatorPercent,
        decimal? EquityIndex,
        decimal? EquityIndexReal,
        DateTime? EconomicOutputAsOf,
        DateTime? PriceIndexAsOf);
}
