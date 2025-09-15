using DashboardFunctions.Infrastructure;
using DashboardFunctions.Services; // added
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.Text.Json;

namespace DashboardFunctions.Functions;

/// <summary>
/// Functions providing jobs / labor market related data via FRED with on-demand cache hydrate (same orchestrator pattern).
/// </summary>
public sealed class JobsFunctions(
    ITimeSeriesFetchOrchestrator orchestrator,
    ITimeSeriesRepositoryFactory repoFactory)
{
    /// <summary>
    /// Returns aligned values for one or more FRED series (default labor market set) over the requested date range.
    /// Values are hydrated into the cache first (EnsureCachedAsync) just like existing endpoints.
    /// Query:
    ///   start=YYYY-MM-DD (required)
    ///   end=YYYY-MM-DD (required)
    ///   series=CSV list of FRED series IDs (optional, default "UNRATE,PAYEMS")
    /// </summary>
    [Function("GetJobsData")]
    public async Task<HttpResponseData> GetJobsData(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "jobs-data")] HttpRequestData req,
        FunctionContext ctx)
    {
        var q = QueryHelpers.ParseQuery(req.Url.Query);
        var startStr = q.TryGetValue("start", out var sv) ? sv.ToString() : null;
        var endStr = q.TryGetValue("end", out var ev) ? ev.ToString() : null;
        var listStr = q.TryGetValue("series", out var ls) ? ls.ToString() : null;

        if (!DateTime.TryParse(startStr, out var start) || !DateTime.TryParse(endStr, out var end) || start > end)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Provide valid start/end (YYYY-MM-DD). Example: ?start=2019-01-01&end=2024-12-31");
            return bad;
        }

        // Default labor market series (can be expanded later)
        var seriesIds = (listStr ?? "UNRATE,PAYEMS")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(12) // safety cap
            .ToArray();

        if (seriesIds.Length == 0)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("No series specified.");
            return bad;
        }

        var ct = ctx.CancellationToken;

        // Hydrate cache for each series
        foreach (var id in seriesIds)
        {
            await orchestrator.EnsureCachedAsync(id, start, end, ct);
        }

        var repo = repoFactory.Resolve();

        // Fetch each series; project to tuple to avoid needing the concrete SeriesPoint type here
        var seriesData = new Dictionary<string, List<(DateTime Date, decimal? Value)>>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in seriesIds)
        {
            var rows = await repo.GetSeriesAsync(id, start, end, ct);
            var simplified = rows.OrderBy(r => r.Date).Select(r => (r.Date, r.Value)).ToList();
            seriesData[id] = simplified;
        }

        // Build unified date set
        var allDates = seriesData.Values
            .SelectMany(list => list.Select(r => r.Date))
            .Where(d => d >= start && d <= end)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        // Map from series/date -> value for quick lookup
        var lookup = new Dictionary<string, Dictionary<DateTime, decimal?>>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in seriesData)
        {
            var inner = new Dictionary<DateTime, decimal?>();
            foreach (var p in kvp.Value) inner[p.Date] = p.Value; // last wins if dup
            lookup[kvp.Key] = inner;
        }

        // Build points. We keep a dictionary<string,object?> per point so variable number of series serialize cleanly.
        var points = new List<Dictionary<string, object?>>(allDates.Count);
        foreach (var date in allDates)
        {
            var point = new Dictionary<string, object?> { ["date"] = date.ToString("yyyy-MM-dd") };
            foreach (var id in seriesIds)
            {
                var prop = ToPropertyName(id);
                lookup[id].TryGetValue(date, out var val);
                point[prop] = val; // may be null
            }
            points.Add(point);
        }

        var ok = req.CreateResponse(HttpStatusCode.OK);
        ok.Headers.Add("Content-Type", "application/json");

        var payload = new
        {
            start = start.ToString("yyyy-MM-dd"),
            end = end.ToString("yyyy-MM-dd"),
            series = seriesIds.Select(id => new { id, property = ToPropertyName(id) }),
            points
        };

        await ok.WriteStringAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        }), ct);

        return ok;

        static string ToPropertyName(string id)
        {
            // Lower camel-ish: keep alnum, replace others with underscore, then lower.
            var cleaned = new string(id.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
            return cleaned.ToLowerInvariant();
        }
    }
}
