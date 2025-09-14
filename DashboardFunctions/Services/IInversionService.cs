using DashboardFunctions.Domain;

namespace DashboardFunctions.Services
{
    public interface IInversionService
    {
        IReadOnlyList<InversionPoint> ComputeSpread(
            IReadOnlyList<SeriesPoint> seriesA,
            IReadOnlyList<SeriesPoint> seriesB);
    }

}
