namespace DashboardFunctions.Services
{
    using DashboardFunctions.Domain;

    internal sealed class BuffettIndicatorService : IBuffettIndicatorService
    {
        public BuffettIndicatorResult Compute(
            IEnumerable<SeriesPoint> marketCap,
            IEnumerable<SeriesPoint> economicOutput,
            IEnumerable<SeriesPoint> equityIndex,
            IEnumerable<SeriesPoint> priceIndex,
            DateTime start,
            DateTime end)
        {
            if (end < start)
            {
                (start, end) = (end, start);
            }

            var startDate = start.Date;
            var endDate = end.Date;

            var marketPoints = marketCap
                .Where(p => p.Date <= endDate)
                .OrderBy(p => p.Date)
                .ToList();
            var gdpPoints = economicOutput
                .Where(p => p.Date <= endDate)
                .OrderBy(p => p.Date)
                .ToList();
            var equityPoints = equityIndex
                .Where(p => p.Date <= endDate)
                .OrderBy(p => p.Date)
                .ToList();
            var pricePoints = priceIndex
                .Where(p => p.Date <= endDate)
                .OrderBy(p => p.Date)
                .ToList();

            var dateSet = new SortedSet<DateTime>();
            foreach (var p in marketPoints)
            {
                if (p.Date >= startDate && p.Date <= endDate)
                {
                    dateSet.Add(p.Date);
                }
            }
            foreach (var p in equityPoints)
            {
                if (p.Date >= startDate && p.Date <= endDate)
                {
                    dateSet.Add(p.Date);
                }
            }
            foreach (var p in gdpPoints)
            {
                if (p.Date >= startDate && p.Date <= endDate)
                {
                    dateSet.Add(p.Date);
                }
            }
            foreach (var p in pricePoints)
            {
                if (p.Date >= startDate && p.Date <= endDate)
                {
                    dateSet.Add(p.Date);
                }
            }

            if (dateSet.Count == 0)
            {
                return new BuffettIndicatorResult(Array.Empty<BuffettIndicatorPoint>(), null, null);
            }

            var orderedDates = dateSet.ToList();
            orderedDates.Sort();

            var basePriceEntry = pricePoints
                .LastOrDefault(p => p.Date <= startDate && p.Value.HasValue)
                ?? pricePoints.FirstOrDefault(p => p.Value.HasValue);
            var basePriceIndex = basePriceEntry?.Value;
            var basePriceDate = basePriceEntry?.Date;

            decimal? latestGdp = null;
            DateTime? latestGdpDate = null;
            decimal? latestPriceIndex = null;
            DateTime? latestPriceDate = null;
            decimal? currentMarketCap = null;
            decimal? currentEquity = null;

            var marketIdx = 0;
            var gdpIdx = 0;
            var equityIdx = 0;
            var priceIdx = 0;

            var firstDate = orderedDates[0];

            while (gdpIdx < gdpPoints.Count && gdpPoints[gdpIdx].Date < firstDate)
            {
                var g = gdpPoints[gdpIdx++];
                if (g.Value.HasValue)
                {
                    latestGdp = g.Value.Value;
                    latestGdpDate = g.Date;
                }
            }

            while (priceIdx < pricePoints.Count && pricePoints[priceIdx].Date < firstDate)
            {
                var c = pricePoints[priceIdx++];
                if (c.Value.HasValue)
                {
                    latestPriceIndex = c.Value.Value;
                    latestPriceDate = c.Date;
                }
            }

            while (marketIdx < marketPoints.Count && marketPoints[marketIdx].Date < firstDate)
            {
                var m = marketPoints[marketIdx++];
                if (m.Value.HasValue)
                {
                    currentMarketCap = m.Value.Value;
                }
            }

            while (equityIdx < equityPoints.Count && equityPoints[equityIdx].Date < firstDate)
            {
                var e = equityPoints[equityIdx++];
                if (e.Value.HasValue)
                {
                    currentEquity = e.Value.Value;
                }
            }

            var results = new List<BuffettIndicatorPoint>(orderedDates.Count);

            foreach (var date in orderedDates)
            {
                while (gdpIdx < gdpPoints.Count && gdpPoints[gdpIdx].Date <= date)
                {
                    var g = gdpPoints[gdpIdx++];
                    if (g.Value.HasValue)
                    {
                        latestGdp = g.Value.Value;
                        latestGdpDate = g.Date;
                    }
                }

                while (priceIdx < pricePoints.Count && pricePoints[priceIdx].Date <= date)
                {
                    var c = pricePoints[priceIdx++];
                    if (c.Value.HasValue)
                    {
                        latestPriceIndex = c.Value.Value;
                        latestPriceDate = c.Date;
                    }
                }

                while (marketIdx < marketPoints.Count && marketPoints[marketIdx].Date <= date)
                {
                    var m = marketPoints[marketIdx++];
                    if (m.Value.HasValue)
                    {
                        currentMarketCap = m.Value.Value;
                    }
                }

                while (equityIdx < equityPoints.Count && equityPoints[equityIdx].Date <= date)
                {
                    var e = equityPoints[equityIdx++];
                    if (e.Value.HasValue)
                    {
                        currentEquity = e.Value.Value;
                    }
                }

                decimal? ratio = null;
                if (currentMarketCap.HasValue && latestGdp.HasValue && latestGdp.Value != 0m)
                {
                    ratio = Math.Round((currentMarketCap.Value / latestGdp.Value) * 100m, 2, MidpointRounding.AwayFromZero);
                }

                decimal? realEquity = null;
                if (currentEquity.HasValue && latestPriceIndex.HasValue && basePriceIndex.HasValue && latestPriceIndex.Value != 0m)
                {
                    realEquity = Math.Round(currentEquity.Value * basePriceIndex.Value / latestPriceIndex.Value, 2, MidpointRounding.AwayFromZero);
                }

                results.Add(new BuffettIndicatorPoint(
                    date,
                    currentMarketCap,
                    latestGdp,
                    ratio,
                    currentEquity,
                    realEquity,
                    latestGdpDate,
                    latestPriceDate));
            }

            return new BuffettIndicatorResult(results, basePriceIndex, basePriceDate);
        }
    }
}
