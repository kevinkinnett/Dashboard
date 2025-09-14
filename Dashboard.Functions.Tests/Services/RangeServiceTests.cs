using DashboardFunctions.Domain;
using DashboardFunctions.Services;
using FluentAssertions;

namespace Dashboard.Functions.Tests.Services
{
    public class RangeServiceTests
    {
        private readonly RangeService _sut = new();

        [Fact]
        public void Coalesce_MergesOverlappingAndAdjacent()
        {
            var ranges = new[]
            {
            new DateRange(new DateTime(2020,1,01), new DateTime(2020,1,10)),
            new DateRange(new DateTime(2020,1,11), new DateTime(2020,1,20)), // adjacent
            new DateRange(new DateTime(2020,2,01), new DateTime(2020,2,05)),
            new DateRange(new DateTime(2020,2,05), new DateTime(2020,2,10)), // overlapping
            new DateRange(new DateTime(2020,3,01), new DateTime(2020,2,25))  // reversed
        };

            var result = _sut.Coalesce(ranges);

            result.Should().HaveCount(3);
            result[0].Should().Be(new DateRange(new DateTime(2020, 1, 01), new DateTime(2020, 1, 20)));
            result[1].Should().Be(new DateRange(new DateTime(2020, 2, 01), new DateTime(2020, 2, 10)));
            result[2].Should().Be(new DateRange(new DateTime(2020, 2, 25), new DateTime(2020, 3, 01)));
        }

        [Fact]
        public void Complement_ComputesGapsWithinTarget()
        {
            var target = new DateRange(new DateTime(2020, 1, 01), new DateTime(2020, 1, 31));
            var covered = new[]
            {
            new DateRange(new DateTime(2020,1,01), new DateTime(2020,1,05)),
            new DateRange(new DateTime(2020,1,10), new DateTime(2020,1,20)),
            new DateRange(new DateTime(2019,12,25), new DateTime(2020,1,01)), // edge overlap
            new DateRange(new DateTime(2020,1,25), new DateTime(2020,2,05))   // edge overlap
        };

            var gaps = _sut.Complement(target, covered);

            gaps.Should().BeEquivalentTo(
            [
            new DateRange(new DateTime(2020,1,06), new DateTime(2020,1,09)),
            new DateRange(new DateTime(2020,1,21), new DateTime(2020,1,24)),
        ], opts => opts.WithoutStrictOrdering());
        }
    }

}
