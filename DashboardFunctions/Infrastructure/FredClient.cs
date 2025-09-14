using DashboardFunctions.Domain;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DashboardFunctions.Infrastructure
{
    /// <summary>
    /// FRED implementation of ISeriesClient for decimal? series.
    /// </summary>
    internal sealed class FredClient : ISeriesClient<decimal?>
    {
        private readonly HttpClient _http;
        private readonly FredOptions _opts;

        public FredClient(HttpClient http, IOptions<FredOptions> opts)
        {
            _http = http;
            _opts = opts.Value;
            if (string.IsNullOrWhiteSpace(_opts.ApiKey))
                throw new InvalidOperationException("Fred__ApiKey not configured.");
        }

        public async Task<IReadOnlyList<Observation<decimal?>>> GetObservationsAsync(
            string seriesId, DateTime start, DateTime end, CancellationToken ct)
        {
            // https://api.stlouisfed.org/fred/series/observations
            var url = $"/fred/series/observations?series_id={Uri.EscapeDataString(seriesId)}" +
                      $"&api_key={Uri.EscapeDataString(_opts.ApiKey!)}" +
                      $"&file_type=json&observation_start={start:yyyy-MM-dd}&observation_end={end:yyyy-MM-dd}";

            using var resp = await _http.GetAsync(url, ct);
            resp.EnsureSuccessStatusCode();

            var model = await resp.Content.ReadFromJsonAsync<FredObsEnvelope>(JsonOptions, ct)
                        ?? new FredObsEnvelope();

            var list = new List<Observation<decimal?>>(model.Observations?.Length ?? 0);
            if (model.Observations is null) return list;

            foreach (var o in model.Observations)
            {
                decimal? val = null;
                if (!string.IsNullOrWhiteSpace(o.Value) && o.Value != "."
                    && decimal.TryParse(o.Value, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var d))
                {
                    val = d;
                }

                if (DateTime.TryParse(o.Date, out var dt))
                    list.Add(new Observation<decimal?>(seriesId, dt.Date, val));
            }

            return list;
        }

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true
        };

        private sealed class FredObsEnvelope
        {
            [JsonPropertyName("observations")] public FredObs[]? Observations { get; set; }
        }

        private sealed class FredObs
        {
            [JsonPropertyName("date")] public string? Date { get; set; }
            [JsonPropertyName("value")] public string? Value { get; set; }
        }
    }
}
