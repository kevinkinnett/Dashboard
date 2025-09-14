using DashboardFunctions.Domain;
using DashboardFunctions.Infrastructure;
using DashboardFunctions.Repositories;
using DashboardFunctions.Services;
using FluentAssertions;
using Moq;

namespace Dashboard.Functions.Tests.Services
{
    public class TimeSeriesFetchOrchestratorTests
    {
        private readonly RangeService _ranges = new();

        [Fact]
        public async Task EnsureCachedAsync_FetchesOnlyGaps_UpdatesCoverage()
        {
            var series = "DGS2";
            var start = new DateTime(2020, 1, 1);
            var end = new DateTime(2020, 1, 31);

            // Mocks for repo & client via factories (new constructor shape)
            var repo = new Mock<ITimeSeriesRepository>(MockBehavior.Strict);
            var client = new Mock<ISeriesClient<decimal?>>(MockBehavior.Strict);

            var repoFactory = new Mock<ITimeSeriesRepositoryFactory>(MockBehavior.Strict);
            repoFactory.Setup(f => f.Resolve()).Returns(repo.Object);

            var clientFactory = new Mock<ISeriesClientFactory<decimal?>>(MockBehavior.Strict);
            clientFactory.Setup(f => f.Resolve()).Returns(client.Object);

            // Existing coverage: 1..10 and 21..25. Gaps => 11..20 and 26..31
            repo.Setup(r => r.GetCoverageAsync(series, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<(DateTime, DateTime)>
                {
                (new DateTime(2020,1,01), new DateTime(2020,1,10)),
                (new DateTime(2020,1,21), new DateTime(2020,1,25)),
                });

            client.Setup(c => c.GetObservationsAsync(series,
                        new DateTime(2020, 1, 11), new DateTime(2020, 1, 20), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(new[]
                  {
                  new Observation<decimal?>(series, new DateTime(2020,1,13), 1.23m),
                  });

            client.Setup(c => c.GetObservationsAsync(series,
                        new DateTime(2020, 1, 26), new DateTime(2020, 1, 31), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(new[]
                  {
                  new Observation<decimal?>(series, new DateTime(2020,1,27), 1.25m),
                  });

            repo.Setup(r => r.UpsertObservationsAsync(
                    It.IsAny<IEnumerable<Observation<decimal?>>>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // IMPORTANT: don't put tuple equality in the predicate; assert in the callback
            repo.Setup(r => r.ReplaceCoverageAsync(
                    series,
                    It.IsAny<IEnumerable<(DateTime Start, DateTime End)>>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask)
                .Callback<string, IEnumerable<(DateTime Start, DateTime End)>, CancellationToken>((_, ranges, __) =>
                {
                    var list = ranges.Select(x => new DateRange(x.Start, x.End))
                                     .OrderBy(r => r.Start)
                                     .ToList();

                    // Expect a single coalesced range covering the full target
                    list.Should().ContainSingle();
                    list[0].Should().Be(new DateRange(new DateTime(2020, 1, 01), new DateTime(2020, 1, 31)));
                });

            var sut = new TimeSeriesFetchOrchestrator(clientFactory.Object, repoFactory.Object, _ranges);

            await sut.EnsureCachedAsync(series, start, end, CancellationToken.None);

            client.VerifyAll();
            repo.VerifyAll();
            repoFactory.Verify(f => f.Resolve(), Times.AtLeastOnce);
            clientFactory.Verify(f => f.Resolve(), Times.AtLeastOnce);
        }

        [Fact]
        public async Task EnsureCachedAsync_NoGaps_NoClientOrWrites()
        {
            var series = "DGS10";
            var start = new DateTime(2020, 1, 1);
            var end = new DateTime(2020, 1, 31);

            var repo = new Mock<ITimeSeriesRepository>(MockBehavior.Strict);
            var client = new Mock<ISeriesClient<decimal?>>(MockBehavior.Strict);

            var repoFactory = new Mock<ITimeSeriesRepositoryFactory>(MockBehavior.Strict);
            repoFactory.Setup(f => f.Resolve()).Returns(repo.Object);

            var clientFactory = new Mock<ISeriesClientFactory<decimal?>>(MockBehavior.Strict);
            clientFactory.Setup(f => f.Resolve()).Returns(client.Object);

            // Already fully covered
            repo.Setup(r => r.GetCoverageAsync(series, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<(DateTime, DateTime)>
                {
                (new DateTime(2020,1,01), new DateTime(2020,1,31))
                });

            var sut = new TimeSeriesFetchOrchestrator(clientFactory.Object, repoFactory.Object, _ranges);

            await sut.EnsureCachedAsync(series, start, end, CancellationToken.None);

            // No reads to client or writes to repo
            client.VerifyNoOtherCalls();
            repo.Verify(r => r.GetCoverageAsync(series, It.IsAny<CancellationToken>()), Times.Once);
            repo.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task EnsureCachedAsync_Idempotent_WithInMemoryRepo()
        {
            var series = "DGS2";
            var start = new DateTime(2020, 1, 1);
            var end = new DateTime(2020, 1, 31);

            // Real in-memory repo to simulate state across calls
            var realRepo = new InMemoryTimeSeriesRepository();

            // Client called only on first run (single gap = full 1..31)
            var client = new Mock<ISeriesClient<decimal?>>(MockBehavior.Strict);
            client.Setup(c => c.GetObservationsAsync(series, start, end, It.IsAny<CancellationToken>()))
                  .ReturnsAsync(Array.Empty<Observation<decimal?>>()) // simulate days with no records; still mark coverage
                  .Verifiable();

            var repoFactory = new Mock<ITimeSeriesRepositoryFactory>(MockBehavior.Strict);
            repoFactory.Setup(f => f.Resolve()).Returns(realRepo);

            var clientFactory = new Mock<ISeriesClientFactory<decimal?>>(MockBehavior.Strict);
            clientFactory.Setup(f => f.Resolve()).Returns(client.Object);

            var sut = new TimeSeriesFetchOrchestrator(clientFactory.Object, repoFactory.Object, _ranges);

            // First call fills coverage (client called once)
            await sut.EnsureCachedAsync(series, start, end, CancellationToken.None);
            client.Verify(c => c.GetObservationsAsync(series, start, end, It.IsAny<CancellationToken>()), Times.Once);

            // Second call: coverage already full -> no client calls
            await sut.EnsureCachedAsync(series, start, end, CancellationToken.None);
            client.Verify(c => c.GetObservationsAsync(series, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);

            // Assert coverage is exactly the target range
            var coverage = await realRepo.GetCoverageAsync(series, CancellationToken.None);
            coverage.Should().ContainSingle()
                    .Which.Should().Be((start, end));
        }

    }
}