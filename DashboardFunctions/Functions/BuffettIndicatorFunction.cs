using DashboardFunctions.Repositories;
using DashboardFunctions.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.Text.Json;
using System.Linq;

namespace DashboardFunctions.Functions
{
    public sealed class BuffettIndicatorFunction(
        ITimeSeriesFetchOrchestrator orchestrator,
        ITimeSeriesRepositoryFactory repositoryFactory,
        IBuffettIndicatorService service)
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        [Function("GetBuffettIndicator")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "buffett-indicator")] HttpRequestData req,
            FunctionContext ctx)
        {
            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var startStr = query.TryGetValue("start", out var sVal) ? sVal.ToString() : null;
            var endStr = query.TryGetValue("end", out var eVal) ? eVal.ToString() : null;

            if (!DateTime.TryParse(startStr, out var start) || !DateTime.TryParse(endStr, out var end) || start > end)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Provide valid start/end (YYYY-MM-DD). Example: ?start=1990-01-01&end=2024-12-31");
                return bad;
            }

            var wilshireSeries = query.TryGetValue("marketCapSeries", out var mVal) ? mVal.ToString() : "WILL5000INDFC";
            var gdpSeries = query.TryGetValue("outputSeries", out var gVal) ? gVal.ToString() : "GDP";
            var spSeries = query.TryGetValue("equitySeries", out var s2Val) ? s2Val.ToString() : "SP500";
            var cpiSeries = query.TryGetValue("priceSeries", out var pVal) ? pVal.ToString() : "CPIAUCSL";

            var ct = ctx.CancellationToken;

            await orchestrator.EnsureCachedAsync(wilshireSeries, start, end, ct);
            await orchestrator.EnsureCachedAsync(gdpSeries, start, end, ct);
            await orchestrator.EnsureCachedAsync(spSeries, start, end, ct);
            await orchestrator.EnsureCachedAsync(cpiSeries, start, end, ct);

            var repo = repositoryFactory.Resolve();

            var market = await repo.GetSeriesAsync(wilshireSeries, start, end, ct);
            var gdp = await repo.GetSeriesAsync(gdpSeries, start, end, ct);
            var sp = await repo.GetSeriesAsync(spSeries, start, end, ct);
            var cpi = await repo.GetSeriesAsync(cpiSeries, start, end, ct);

            var result = service.Compute(market, gdp, sp, cpi, start, end);

            var payload = new
            {
                start = start.ToString("yyyy-MM-dd"),
                end = end.ToString("yyyy-MM-dd"),
                marketCapSeries = wilshireSeries,
                outputSeries = gdpSeries,
                equitySeries = spSeries,
                priceSeries = cpiSeries,
                basePriceIndex = result.BasePriceIndex,
                basePriceIndexDate = result.BasePriceIndexDate?.ToString("yyyy-MM-dd"),
                points = result.Points.Select(p => new
                {
                    date = p.Date.ToString("yyyy-MM-dd"),
                    marketCap = p.MarketCap,
                    economicOutput = p.EconomicOutput,
                    indicatorPercent = p.IndicatorPercent,
                    equityIndex = p.EquityIndex,
                    equityIndexReal = p.EquityIndexReal,
                    economicOutputAsOf = p.EconomicOutputAsOf?.ToString("yyyy-MM-dd"),
                    priceIndexAsOf = p.PriceIndexAsOf?.ToString("yyyy-MM-dd")
                })
            };

            var ok = req.CreateResponse(HttpStatusCode.OK);
            ok.Headers.Add("Content-Type", "application/json");
            await ok.WriteStringAsync(JsonSerializer.Serialize(payload, JsonOptions), ct);
            return ok;
        }
    }
}
