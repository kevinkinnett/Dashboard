//using DashboardFunctions.Domain;
//using DashboardFunctions.Infrastructure;
//using DashboardFunctions.Services;
//using Microsoft.AspNetCore.WebUtilities;
//using Microsoft.Azure.Functions.Worker;
//using Microsoft.Azure.Functions.Worker.Http;
//using System.Net;
//using System.Net.Http.Json;
//using System.Text.Json;
//using System.Text.Json.Serialization;

//namespace DashboardFunctions.Functions;

///// <summary>
///// Returns (and caches) daily observed sun spot numbers from NOAA SWPC.
///// Data source: https://services.swpc.noaa.gov/json/solar-cycle/sunspots.json
///// Caching approach mirrors time-series functions: we persist observations & maintain coverage ranges.
///// Since source endpoint returns the full historical data set, on a cache miss we ingest all rows once
///// and mark the entire available range as covered. Subsequent requests over any sub-range avoid refetching.
///// </summary>
//public sealed class GetSunSpotsFunction(
//    ITimeSeriesRepositoryFactory repoFactory,
//    IRangeService ranges)
//{
//    private static readonly HttpClient Http = new()
//    {
//        BaseAddress = new Uri("https://services.swpc.noaa.gov")
//    };

//    private const string SeriesId = "SUNSPOTS"; // Internal series identifier used for caching

//    [Function("GetSunSpots")]
//    public async Task<HttpResponseData> Run(
//        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "sunspots")] HttpRequestData req,
//        FunctionContext ctx)
//    {
//        var q = QueryHelpers.ParseQuery(req.Url.Query);
//        var startStr = q.TryGetValue("start", out var sv) ? sv.ToString() : null;
//        var endStr = q.TryGetValue("end", out var ev) ? ev.ToString() : null;

//        if (!DateTime.TryParse(startStr, out var start) ||
//            !DateTime.TryParse(endStr, out var end) || start > end)
//        {
//            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
//            await bad.WriteStringAsync("Provide valid start/end (YYYY-MM-DD). Example: ?start=2019-01-01&end=2024-12-31");
//            return bad;
//        }

//        var ct = ctx.CancellationToken;
//        var repo = repoFactory.Resolve();

//        // Determine gaps in requested range
//        var target = new DateRange(start.Date, end.Date).Normalize();
//        var existingCoverage = await repo.GetCoverageAsync(SeriesId, ct);
//        var coveredRanges = existingCoverage.Select(c => new DateRange(c.Start, c.End));
//        var gaps = ranges.Complement(target, coveredRanges);

//        if (gaps.Count > 0)
//        {
//            // Fetch full dataset once (endpoint does not support date filtering)
//            List<SunspotRow>? data = null;
//            try
//            {
//                data = await Http.GetFromJsonAsync<List<SunspotRow>>("/json/solar-cycle/sunspots.json", JsonOpts, ct);
//            }
//            catch (Exception ex)
//            {
//                var err = req.CreateResponse(HttpStatusCode.BadGateway);
//                await err.WriteStringAsync($"Failed to fetch sun spot data: {ex.Message}", ct);
//                return err;
//            }

//            if (data is { Count: > 0 })
//            {
//                // Transform into observations; choose primary numeric field (ssn). Fallback attempts included.
//                var observations = (from row in data let date = row.TimeTag.Date let value = row.Ssn ?? row.SunspotNumber ?? row.Observed ?? row.Smoothed select new Observation<decimal?>(SeriesId, date, value)).ToList();

//                if (observations.Count > 0)
//                {
//                    await repo.UpsertObservationsAsync(observations, ct);

//                    // Mark full dataset range as covered (min..max) merged with prior coverage
//                    var min = observations.Min(o => o.Date);
//                    var max = observations.Max(o => o.Date);
//                    var newCoverage = ranges.Coalesce(coveredRanges.Append(new DateRange(min, max)));
//                    await repo.ReplaceCoverageAsync(SeriesId, newCoverage.Select(r => (r.Start, r.End)), ct);
//                }
//            }
//        }

//        // Read requested window
//        var rows = await repo.GetSeriesAsync(SeriesId, start, end, ct);

//        var ok = req.CreateResponse(HttpStatusCode.OK);
//        ok.Headers.Add("Content-Type", "application/json");
//        var payload = new
//        {
//            series = SeriesId,
//            start = start.ToString("yyyy-MM-dd"),
//            end = end.ToString("yyyy-MM-dd"),
//            points = rows.Select(r => new
//            {
//                date = r.Date.ToString("yyyy-MM-dd"),
//                value = r.Value
//            })
//        };
//        await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
//        {
//            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
//            WriteIndented = true
//        }), ct);
//        return ok;
//    }

//    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
//    {
//        PropertyNameCaseInsensitive = true,
//        NumberHandling = JsonNumberHandling.AllowReadingFromString
//    };

//    // Attempt to cover possible field names present in NOAA payload.
//    private sealed class SunspotRow
//    {
//        [JsonPropertyName("time-tag")] public DateTime TimeTag { get; set; }
//        [JsonPropertyName("ssn")] public decimal? Ssn { get; set; }
//        [JsonPropertyName("sunspot_number")] public decimal? SunspotNumber { get; set; }
//        [JsonPropertyName("observed")] public decimal? Observed { get; set; }
//        [JsonPropertyName("smoothed_ssn")] public decimal? Smoothed { get; set; }
//    }
//}
