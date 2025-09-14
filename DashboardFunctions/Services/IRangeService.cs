using DashboardFunctions.Domain;

namespace DashboardFunctions.Services
{
    /// <summary>Set algebra over closed date ranges on the daily grid.</summary>
    public interface IRangeService
    {
        IReadOnlyList<DateRange> Coalesce(IEnumerable<DateRange> ranges);
        IReadOnlyList<DateRange> Complement(DateRange target, IEnumerable<DateRange> covered);
    }
}
