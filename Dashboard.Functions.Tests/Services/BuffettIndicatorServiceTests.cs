using DashboardFunctions.Domain;
using DashboardFunctions.Services;
using FluentAssertions;
using System.Linq;

namespace Dashboard.Functions.Tests.Services
{
    public class BuffettIndicatorServiceTests
    {
        private readonly BuffettIndicatorService _sut = new();

        [Fact]
        public void Compute_ReturnsExpectedRatiosAndForwardFill()
        {
            var market = new[]
            {
                new SeriesPoint(new DateTime(2020, 1, 1), 20000m),
                new SeriesPoint(new DateTime(2020, 1, 2), 21000m),
            };
            var gdp = new[]
            {
                new SeriesPoint(new DateTime(2020, 1, 1), 21000m),
                new SeriesPoint(new DateTime(2020, 4, 1), 20500m),
            };
            var sp = new[]
            {
                new SeriesPoint(new DateTime(2020, 1, 1), 3000m),
                new SeriesPoint(new DateTime(2020, 1, 2), 3050m),
            };
            var cpi = new[]
            {
                new SeriesPoint(new DateTime(2020, 1, 1), 100m),
                new SeriesPoint(new DateTime(2020, 2, 1), 101m),
            };

            var result = _sut.Compute(market, gdp, sp, cpi, new DateTime(2020, 1, 1), new DateTime(2020, 4, 1));

            result.BasePriceIndex.Should().Be(100m);
            result.BasePriceIndexDate.Should().Be(new DateTime(2020, 1, 1));
            result.Points.Should().HaveCount(4);

            var jan1 = result.Points[0];
            jan1.Date.Should().Be(new DateTime(2020, 1, 1));
            jan1.IndicatorPercent.Should().Be(95.24m);
            jan1.EquityIndex.Should().Be(3000m);
            jan1.EquityIndexReal.Should().Be(3000m);
            jan1.EconomicOutputAsOf.Should().Be(new DateTime(2020, 1, 1));
            jan1.PriceIndexAsOf.Should().Be(new DateTime(2020, 1, 1));

            var jan2 = result.Points[1];
            jan2.Date.Should().Be(new DateTime(2020, 1, 2));
            jan2.IndicatorPercent.Should().Be(100m);
            jan2.EquityIndex.Should().Be(3050m);
            jan2.EquityIndexReal.Should().Be(3050m);

            var feb1 = result.Points.Single(p => p.Date == new DateTime(2020, 2, 1));
            feb1.EquityIndex.Should().Be(3050m);
            feb1.EquityIndexReal.Should().Be(3019.80m);
            feb1.PriceIndexAsOf.Should().Be(new DateTime(2020, 2, 1));

            var apr1 = result.Points.Last();
            apr1.Date.Should().Be(new DateTime(2020, 4, 1));
            apr1.IndicatorPercent.Should().Be(102.44m);
            apr1.EconomicOutput.Should().Be(20500m);
            apr1.EconomicOutputAsOf.Should().Be(new DateTime(2020, 4, 1));
        }

        [Fact]
        public void Compute_UsesLatestPriceIndexPriorToStartAsBase()
        {
            var market = new[]
            {
                new SeriesPoint(new DateTime(2020, 2, 15), 22000m),
            };
            var gdp = new[]
            {
                new SeriesPoint(new DateTime(2019, 10, 1), 20500m),
            };
            var sp = new[]
            {
                new SeriesPoint(new DateTime(2020, 2, 15), 3400m),
            };
            var cpi = new[]
            {
                new SeriesPoint(new DateTime(2019, 12, 1), 99m),
                new SeriesPoint(new DateTime(2020, 3, 1), 101m),
            };

            var result = _sut.Compute(market, gdp, sp, cpi, new DateTime(2020, 2, 15), new DateTime(2020, 3, 31));

            result.BasePriceIndex.Should().Be(99m);
            result.BasePriceIndexDate.Should().Be(new DateTime(2019, 12, 1));
            result.Points.Should().ContainSingle();
            result.Points[0].EquityIndexReal.Should().Be(3400m);
        }

        [Fact]
        public void Compute_ReturnsEmptyWhenNoSeriesOverlap()
        {
            var result = _sut.Compute(
                Array.Empty<SeriesPoint>(),
                Array.Empty<SeriesPoint>(),
                Array.Empty<SeriesPoint>(),
                Array.Empty<SeriesPoint>(),
                new DateTime(2021, 1, 1),
                new DateTime(2021, 12, 31));

            result.BasePriceIndex.Should().BeNull();
            result.BasePriceIndexDate.Should().BeNull();
            result.Points.Should().BeEmpty();
        }
    }
}
