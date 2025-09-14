using DashboardFunctions.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;

namespace Dashboard.Functions.Tests.Infrastructure
{
    public class FredClientTests
    {
        [Fact]
        public async Task ParsesObservations_DotMeansNull()
        {
            var json = """
        {
          "observations": [
            { "date": "2020-01-01", "value": "1.50" },
            { "date": "2020-01-02", "value": "." },
            { "date": "2020-01-03", "value": "1.75" }
          ]
        }
        """;

            var handler = new StubHandler(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });

            var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.stlouisfed.org") };
            var opts = Options.Create(new FredOptions { ApiKey = "TEST_KEY", BaseUrl = "https://api.stlouisfed.org" });
            var sut = new FredClient(http, opts);

            var result = await sut.GetObservationsAsync("DGS2",
                new DateTime(2020, 1, 01), new DateTime(2020, 1, 31), CancellationToken.None);

            result.Should().HaveCount(3);
            result[0].Value.Should().Be(1.50m);
            result[1].Value.Should().BeNull();
            result[2].Value.Should().Be(1.75m);
        }

        private sealed class StubHandler(HttpResponseMessage response) : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
                => Task.FromResult(response);
        }
    }

}
