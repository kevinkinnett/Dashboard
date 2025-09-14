using DashboardFunctions.Domain;
using DashboardFunctions.Services;
using FluentAssertions;

namespace Dashboard.Functions.Tests.Services
{
    public class InversionServiceTests
    {
        private readonly InversionService _sut = new();

        [Fact]
        public void ComputeSpread_JoinsOnDate_HandlesNulls()
        {
            var a = new[]
            {
            new SeriesPoint(new DateTime(2020,1,01), 1.50m),
            new SeriesPoint(new DateTime(2020,1,02), null),
            new SeriesPoint(new DateTime(2020,1,03), 1.55m),
        };

            var b = new[]
            {
            new SeriesPoint(new DateTime(2020,1,01), 1.40m),
            new SeriesPoint(new DateTime(2020,1,03), 1.70m),
            new SeriesPoint(new DateTime(2020,1,04), 1.80m),
        };

            var result = _sut.ComputeSpread(a, b);

            result.Should().HaveCount(2);
            result[0].Should().BeEquivalentTo(new InversionPoint(new DateTime(2020, 1, 01), 1.50m, 1.40m, 0.10m));
            result[1].Date.Should().Be(new DateTime(2020, 1, 03));
            result[1].Spread.Should().Be(1.55m - 1.70m);
        }
    }

}
