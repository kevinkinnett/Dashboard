using Azure.Storage.Blobs;
using DashboardFunctions.Infrastructure;
using DashboardFunctions.Services;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text.Json;

namespace DashboardFunctions.Functions
{
    public sealed class GetYieldInversionFunction(
        ITimeSeriesFetchOrchestrator orchestrator,
        ITimeSeriesRepositoryFactory repoFactory,
        IInversionService inversion,
        IOptions<StorageCacheOptions> storageOptions) // added for delete endpoint
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
                points = spread.Select(p => new
                {
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

        // GDP growth endpoint. Adds mode switch for Quarter-over-Quarter (qoq) vs Year-over-Year (yoy) calculations.
        [Function("GetGdpGrowth")]
        public async Task<HttpResponseData> GetGdpGrowth(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "gdp-growth")] HttpRequestData req,
            FunctionContext ctx)
        {
            var q = QueryHelpers.ParseQuery(req.Url.Query);
            var startStr = q.TryGetValue("start", out var sv) ? sv.ToString() : null;
            var endStr = q.TryGetValue("end", out var ev) ? ev.ToString() : null;
            var series = q.TryGetValue("series", out var s) ? s.ToString() : "GDPC1"; // Real GDP
            var mode = q.TryGetValue("mode", out var m) ? m.ToString().ToLowerInvariant() : "qoq"; // qoq | yoy
            if (mode != "qoq" && mode != "yoy") mode = "qoq";

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

            // Always quarterly per requirement.
            const string frequency = "Quarterly";
            const int periodsPerYear = 4;

            var growthPoints = new List<object>(ordered.Count);

            for (var i = 0; i < ordered.Count; i++)
            {
                var r = ordered[i];
                decimal? prevVal = null; // value used as comparison base
                decimal? absChange = null;
                decimal? pctChange = null; // period or YoY change %
                decimal? annualizedPct = null; // only meaningful for qoq

                if (r.Value.HasValue)
                {
                    switch (mode)
                    {
                        case "qoq" when i > 0:
                        {
                            var prev = ordered[i - 1];
                            if (prev.Value.HasValue)
                            {
                                prevVal = prev.Value.Value;
                                absChange = r.Value.Value - prevVal.Value;
                                if (prevVal.Value != 0m)
                                {
                                    pctChange = (absChange / prevVal.Value) * 100m;
                                    // annualize QoQ change ( (new/old)^4 - 1 )
                                    if (prevVal.Value > 0 && r.Value.Value > 0)
                                    {
                                        var ratio = r.Value.Value / prevVal.Value;
                                        annualizedPct = (decimal)(Math.Pow((double)ratio, periodsPerYear) - 1d) * 100m;
                                    }
                                }
                            }

                            break;
                        }
                        case "yoy" when i >= periodsPerYear:
                        {
                            var prev = ordered[i - periodsPerYear];
                            if (prev.Value.HasValue)
                            {
                                prevVal = prev.Value.Value;
                                absChange = r.Value.Value - prevVal.Value;
                                if (prevVal.Value != 0m)
                                {
                                    // YoY change already annual by definition
                                    pctChange = (absChange / prevVal.Value) * 100m;
                                    annualizedPct = null; // not applicable / redundant
                                }
                            }

                            break;
                        }
                    }
                }

                growthPoints.Add(new
                {
                    date = r.Date.ToString("yyyy-MM-dd"),
                    value = r.Value,
                    prev = prevVal, // the comparison value (previous quarter or same quarter prior year)
                    change = absChange,
                    changePct = RoundPct(pctChange),
                    annualizedChangePct = RoundPct(annualizedPct)
                });
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
                mode,
                points = growthPoints
            };
            await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }), ct);
            return ok;

            // Helper local for rounding
            decimal? RoundPct(decimal? v) => v.HasValue ? Math.Round(v.Value, 4, MidpointRounding.AwayFromZero) : null;
        }

        private static string Sanitize(string seriesId)
        {
            if (string.IsNullOrWhiteSpace(seriesId)) return "unknown";
            var chars = seriesId.Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '_').ToArray();
            return new string(chars);
        }

        // DELETE endpoint to clear selected cache blobs (coverage + specific observation blobs)
        [Function("DeleteCacheBlobs")]
        public async Task<HttpResponseData> DeleteCacheBlobs(
            [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "yield")] HttpRequestData req,
            FunctionContext ctx)
        {
            var opts = storageOptions.Value ?? throw new InvalidOperationException("Storage options not configured");
            if (string.IsNullOrWhiteSpace(opts.ConnectionString))
            {
                var bad = req.CreateResponse(HttpStatusCode.InternalServerError);
                await bad.WriteStringAsync("Storage connection string missing.");
                return bad;
            }

            var container = new BlobContainerClient(opts.ConnectionString, opts.ContainerName);
            await container.CreateIfNotExistsAsync(cancellationToken: ctx.CancellationToken);

            var series = new[] { "DGS2", "DGS10", "GDPC1" };
            var results = new List<object>();

            var coverageBlob = container.GetBlobClient(opts.CoverageBlobName);
            var coverageDeleted = await coverageBlob.DeleteIfExistsAsync(cancellationToken: ctx.CancellationToken);
            results.Add(new { blob = opts.CoverageBlobName, deleted = coverageDeleted.Value });

            foreach (var s in series)
            {
                var blobName = $"obs-{Sanitize(s)}.csv";
                var blob = container.GetBlobClient(blobName);
                var deleted = await blob.DeleteIfExistsAsync(cancellationToken: ctx.CancellationToken);
                results.Add(new { blob = blobName, deleted = deleted.Value });
            }

            var ok = req.CreateResponse(HttpStatusCode.OK);
            ok.Headers.Add("Content-Type", "application/json");

            var payload = new
            {
                message = "Selected cache blobs deleted (if they existed).",
                container = opts.ContainerName,
                blobs = results,
                note = "Subsequent data requests will regenerate cache as needed via orchestrator."
            };

            await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }), ctx.CancellationToken);
            return ok;
        }
    }
}
