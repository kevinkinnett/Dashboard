using DashboardFunctions.Domain;

namespace DashboardFunctions.Services
{
    internal sealed class InversionService : IInversionService
    {
        public IReadOnlyList<InversionPoint> ComputeSpread(
            IReadOnlyList<SeriesPoint> seriesA,
            IReadOnlyList<SeriesPoint> seriesB)
        {
            var dictB = seriesB.ToDictionary(x => x.Date, x => x.Value);
            var list = new List<InversionPoint>(Math.Min(seriesA.Count, seriesB.Count));
            foreach (var a in seriesA)
            {
                if (!dictB.TryGetValue(a.Date, out var bv)) continue;
                decimal? spread = (a.Value.HasValue && bv.HasValue) ? a.Value.Value - bv.Value : null;
                list.Add(new InversionPoint(a.Date, a.Value, bv, spread));
            }
            return list.OrderBy(x => x.Date).ToList();
        }
    }

}
