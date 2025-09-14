using DashboardFunctions.Infrastructure;
using DashboardFunctions.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.Text.Json;

namespace DashboardFunctions.Functions
{
    public sealed class GetYieldInversionFunction(
        ITimeSeriesFetchOrchestrator orchestrator,
        ITimeSeriesRepositoryFactory repoFactory,
        IInversionService inversion)
    {
        [Function("GetYieldInversion")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "yield-inversion")]
        HttpRequestData req,
            FunctionContext ctx)
        {
            var q = QueryHelpers.ParseQuery(req.Url.Query);
            var startStr = q.TryGetValue("start", out var sv) ? sv.ToString() : null;
            var endStr = q.TryGetValue("end", out var ev) ? ev.ToString() : null;
            var seriesA = q.TryGetValue("seriesA", out var a) ? a.ToString() : "DGS10";
            var seriesB = q.TryGetValue("seriesB", out var b) ? b.ToString() : "DGS2";

            if (!DateTime.TryParse(startStr, out var start) ||
                !DateTime.TryParse(endStr, out var end) || start > end)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Provide valid start/end (YYYY-MM-DD). Example: ?start=2019-01-01&end=2024-12-31");
                return bad;
            }

            var ct = ctx.CancellationToken;

            // Ensure cache
            await orchestrator.EnsureCachedAsync(seriesA, start, end, ct);
            await orchestrator.EnsureCachedAsync(seriesB, start, end, ct);

            // Resolve the (possibly mocked) repo for this request
            var repo = repoFactory.Resolve();

            // Read & compute
            var aRows = await repo.GetSeriesAsync(seriesA, start, end, ct);
            var bRows = await repo.GetSeriesAsync(seriesB, start, end, ct);
            var spread = inversion.ComputeSpread(aRows, bRows);

            var ok = req.CreateResponse(HttpStatusCode.OK);
            ok.Headers.Add("Content-Type", "application/json");

            var payload = new
            {
                seriesA,
                seriesB,
                start = start.ToString("yyyy-MM-dd"),
                end = end.ToString("yyyy-MM-dd"),
                points = spread.Select(p => new {
                    date = p.Date.ToString("yyyy-MM-dd"),
                    a = p.SeriesA,
                    b = p.SeriesB,
                    spread = p.Spread
                })
            };

            await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }), ct);

            return ok;
        }

        // GDP growth endpoint. Computes absolute, percentage, and annualized percentage change between consecutive points.
        [Function("GetGdpGrowth")]
        public async Task<HttpResponseData> GetGdpGrowth(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "gdp-growth")] HttpRequestData req,
            FunctionContext ctx)
        {
            var q = QueryHelpers.ParseQuery(req.Url.Query);
            var startStr = q.TryGetValue("start", out var sv) ? sv.ToString() : null;
            var endStr = q.TryGetValue("end", out var ev) ? ev.ToString() : null;
            var series = q.TryGetValue("series", out var s) ? s.ToString() : "GDPC1"; // Real GDP

            if (!DateTime.TryParse(startStr, out var start) ||
                !DateTime.TryParse(endStr, out var end) || start > end)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Provide valid start/end (YYYY-MM-DD). Example: ?start=2010-01-01&end=2024-12-31");
                return bad;
            }

            var ct = ctx.CancellationToken;

            await orchestrator.EnsureCachedAsync(series, start, end, ct);
            var repo = repoFactory.Resolve();
            var rows = await repo.GetSeriesAsync(series, start, end, ct);
            var ordered = rows.OrderBy(r => r.Date).ToList();

            // Detect frequency based on median/first interval in days.
            var frequency = "Unknown";
            var periodsPerYear = 1;
            if (ordered.Count > 1)
            {
                var diffs = ordered.Skip(1).Select((r, i) => (r.Date - ordered[i].Date).TotalDays).ToList();
                var first = diffs.First();
                switch (first)
                {
                    // Simple heuristic buckets
                    case >= 80 and <= 100:
                        frequency = "Quarterly"; periodsPerYear = 4;
                        break;
                    case >= 26 and <= 35:
                        frequency = "Monthly"; periodsPerYear = 12;
                        break;
                    case >= 6 and <= 8:
                        frequency = "Weekly"; periodsPerYear = 52;
                        break;
                    case >= 1 and <= 2:
                        frequency = "Daily"; periodsPerYear = 365;
                        break;
                    default:
                    {
                        frequency = $"Every ~{Math.Round(first,0)} days"; periodsPerYear = (int)Math.Round(365.0/ first); if (periodsPerYear < 1) periodsPerYear = 1;
                        break;
                    }
                }
            }

            decimal? prev = null;
            var growthPoints = new List<object>(ordered.Count);
            foreach (var r in ordered)
            {
                decimal? absChange = null;
                decimal? pctChange = null; // period change %
                decimal? annualizedPct = null; // annualized change %
                if (r.Value.HasValue && prev.HasValue)
                {
                    absChange = r.Value.Value - prev.Value;
                    if (prev.Value != 0m)
                    {
                        pctChange = (absChange / prev.Value) * 100m; // already percent
                        // Annualize only if periodsPerYear > 1 and value positive (avoid complex cases with negatives or zeros)
                        if (periodsPerYear > 1 && prev.Value > 0 && r.Value.Value > 0)
                        {
                            var ratio = r.Value.Value / prev.Value; // growth factor for the period
                            // Use double for exponent then convert back
                            var annFactor = Math.Pow((double)ratio, periodsPerYear) - 1d;
                            annualizedPct = (decimal)annFactor * 100m;
                        }
                    }
                }
                // Round to 4 decimals for pct values for readability
                decimal? RoundPct(decimal? v) => v.HasValue ? Math.Round(v.Value, 4, MidpointRounding.AwayFromZero) : null;

                growthPoints.Add(new
                {
                    date = r.Date.ToString("yyyy-MM-dd"),
                    value = r.Value,
                    prev = prev,
                    change = absChange,
                    changePct = RoundPct(pctChange),
                    annualizedChangePct = RoundPct(annualizedPct)
                });
                prev = r.Value;
            }

            var ok = req.CreateResponse(HttpStatusCode.OK);
            ok.Headers.Add("Content-Type", "application/json");
            var payload = new
            {
                series,
                start = start.ToString("yyyy-MM-dd"),
                end = end.ToString("yyyy-MM-dd"),
                frequency,
                periodsPerYear,
                points = growthPoints
            };
            await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }), ct);
            return ok;
        }
    }
}
