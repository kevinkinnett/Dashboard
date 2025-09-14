using System.Text;
using System.Collections.Concurrent;
using DashboardFunctions.Domain;
using DashboardFunctions.Infrastructure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;

namespace DashboardFunctions.Repositories
{
    /// <summary>
    /// Blob-backed repository storing observations & coverage as CSV in Azure Blob Storage.
    /// New layout: each series stored in its own observations blob: obs-{sanitizedSeriesId}.csv
    /// Coverage still centralized in coverage.csv.
    /// observations blob format: SeriesId,Date,Value (ISO date, Value may be empty)
    /// coverage.csv: SeriesId,StartDate,EndDate
    /// </summary>
    internal sealed class BlobCsvTimeSeriesRepository : ITimeSeriesRepository
    {
        private readonly StorageCacheOptions _opts;
        private readonly BlobContainerClient _container;
        private readonly SemaphoreSlim _sync = new(1,1);
        private volatile bool _loaded;

        // In-memory structures
        private readonly ConcurrentDictionary<(string SeriesId, DateTime Date), decimal?> _data = new();
        private readonly ConcurrentDictionary<string, List<(DateTime Start, DateTime End)>> _coverage = new();

        public BlobCsvTimeSeriesRepository(IOptions<StorageCacheOptions> options)
        {
            _opts = options.Value ?? throw new InvalidOperationException("StorageCache options missing");
            if (string.IsNullOrWhiteSpace(_opts.ConnectionString))
                throw new InvalidOperationException("Storage cache connection string missing");
            var service = new BlobServiceClient(_opts.ConnectionString);
            _container = service.GetBlobContainerClient(_opts.ContainerName);
        }

        private async Task EnsureLoadedAsync(CancellationToken ct)
        {
            if (_loaded) return;
            await _sync.WaitAsync(ct);
            try
            {
                if (_loaded) return;
                await _container.CreateIfNotExistsAsync(cancellationToken: ct);
                await LoadObservationsAsync(ct);
                await LoadCoverageAsync(ct);
                _loaded = true;
            }
            finally
            {
                _sync.Release();
            }
        }

        private static string SanitizeSeriesId(string seriesId)
        {
            if (string.IsNullOrWhiteSpace(seriesId)) return "unknown";
            var sb = new StringBuilder(seriesId.Length);
            foreach (var ch in seriesId)
            {
                if (char.IsLetterOrDigit(ch) || ch == '-' || ch == '_') sb.Append(ch);
                else sb.Append('_');
            }
            return sb.ToString();
        }

        private BlobClient GetObservationBlobClient(string seriesId)
        {
            var safe = SanitizeSeriesId(seriesId);
            var name = $"obs-{safe}.csv"; // prefix for enumeration
            return _container.GetBlobClient(name);
        }

        private async Task LoadObservationsAsync(CancellationToken ct)
        {
            // Legacy single-file support (observations.csv) if still present.
            var legacyBlob = _container.GetBlobClient(_opts.ObservationsBlobName);
            if (await legacyBlob.ExistsAsync(ct))
            {
                var dl = await legacyBlob.DownloadContentAsync(ct);
                var legacyLines = Encoding.UTF8.GetString(dl.Value.Content.ToArray()).Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var line in legacyLines.Skip(1))
                {
                    var parts = line.Split(',', 3);
                    if (parts.Length < 3) continue;
                    var sid = parts[0];
                    if (!DateTime.TryParse(parts[1], out var date)) continue;
                    decimal? val = null;
                    if (!string.IsNullOrWhiteSpace(parts[2]) && decimal.TryParse(parts[2], out var dv)) val = dv;
                    _data[(sid, date.Date)] = val;
                }
            }

            // New per-series blobs: enumerate all blobs with prefix "obs-".
            await foreach (var blobItem in _container.GetBlobsAsync(prefix: "obs-", cancellationToken: ct))
            {
                var blob = _container.GetBlobClient(blobItem.Name);
                var dl = await blob.DownloadContentAsync(ct);
                var lines = Encoding.UTF8.GetString(dl.Value.Content.ToArray()).Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var line in lines.Skip(1))
                {
                    var parts = line.Split(',', 3);
                    if (parts.Length < 3) continue;
                    var sid = parts[0];
                    if (!DateTime.TryParse(parts[1], out var date)) continue;
                    decimal? val = null;
                    if (!string.IsNullOrWhiteSpace(parts[2]) && decimal.TryParse(parts[2], out var dv)) val = dv;
                    _data[(sid, date.Date)] = val;
                }
            }
        }

        private async Task LoadCoverageAsync(CancellationToken ct)
        {
            var blob = _container.GetBlobClient(_opts.CoverageBlobName);
            if (!await blob.ExistsAsync(ct)) return;
            var dl = await blob.DownloadContentAsync(ct);
            var lines = Encoding.UTF8.GetString(dl.Value.Content.ToArray()).Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var line in lines.Skip(1))
            {
                var parts = line.Split(',', 3);
                if (parts.Length < 3) continue;
                var sid = parts[0];
                if (!DateTime.TryParse(parts[1], out var start)) continue;
                if (!DateTime.TryParse(parts[2], out var end)) continue;
                var list = _coverage.GetOrAdd(sid, _ => []); // ensure named tuple
                list.Add((Start: start.Date, End: end.Date));
            }
            // Normalize ordering
            foreach (var k in _coverage.Keys)
                _coverage[k] = _coverage[k].OrderBy(r => r.Start).ToList();
        }

        private async Task FlushObservationsAsync(IEnumerable<string> seriesIds, CancellationToken ct)
        {
            var distinct = seriesIds.Distinct().ToList();
            foreach (var sid in distinct)
            {
                var sb = new StringBuilder();
                sb.AppendLine("SeriesId,Date,Value");
                foreach (var kv in _data.Where(k => k.Key.SeriesId == sid).OrderBy(k => k.Key.Date))
                {
                    sb.Append(kv.Key.SeriesId).Append(',').Append(kv.Key.Date.ToString("yyyy-MM-dd")).Append(',');
                    if (kv.Value.HasValue) sb.Append(kv.Value.Value);
                    sb.AppendLine();
                }
                var blob = GetObservationBlobClient(sid);
                await using var ms = new MemoryStream(Encoding.UTF8.GetBytes(sb.ToString()));
                await blob.UploadAsync(ms, overwrite: true, cancellationToken: ct);
            }
        }

        private async Task FlushCoverageAsync(CancellationToken ct)
        {
            var sbCov = new StringBuilder();
            sbCov.AppendLine("SeriesId,StartDate,EndDate");
            foreach (var kv in _coverage.OrderBy(k => k.Key))
            {
                foreach (var (s, e) in kv.Value.OrderBy(r => r.Start))
                {
                    sbCov.Append(kv.Key).Append(',').Append(s.ToString("yyyy-MM-dd")).Append(',').Append(e.ToString("yyyy-MM-dd")).AppendLine();
                }
            }
            var covBlob = _container.GetBlobClient(_opts.CoverageBlobName);
            await using var covStream = new MemoryStream(Encoding.UTF8.GetBytes(sbCov.ToString()));
            await covBlob.UploadAsync(covStream, overwrite: true, cancellationToken: ct);
        }

        public async Task<IReadOnlyList<(DateTime Start, DateTime End)>> GetCoverageAsync(string seriesId, CancellationToken ct)
        {
            await EnsureLoadedAsync(ct);
            return _coverage.TryGetValue(seriesId, out var list) ? list.OrderBy(r => r.Start).ToList() : [];
        }

        public async Task UpsertObservationsAsync(IEnumerable<Observation<decimal?>> rows, CancellationToken ct)
        {
            await EnsureLoadedAsync(ct);
            await _sync.WaitAsync(ct);
            try
            {
                var touchedSeries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var r in rows)
                {
                    _data[(r.SeriesId, r.Date.Date)] = r.Value;
                    touchedSeries.Add(r.SeriesId);
                }
                if (touchedSeries.Count > 0)
                    await FlushObservationsAsync(touchedSeries, ct);
            }
            finally { _sync.Release(); }
        }

        public async Task ReplaceCoverageAsync(string seriesId, IEnumerable<(DateTime Start, DateTime End)> ranges, CancellationToken ct)
        {
            await EnsureLoadedAsync(ct);
            await _sync.WaitAsync(ct);
            try
            {
                _coverage[seriesId] = ranges.Select(r => (Start: r.Start.Date, End: r.End.Date)).OrderBy(r => r.Start).ToList();
                await FlushCoverageAsync(ct);
            }
            finally { _sync.Release(); }
        }

        public async Task<IReadOnlyList<SeriesPoint>> GetSeriesAsync(string seriesId, DateTime start, DateTime end, CancellationToken ct)
        {
            await EnsureLoadedAsync(ct);
            var res = _data
                .Where(kv => kv.Key.SeriesId == seriesId && kv.Key.Date >= start.Date && kv.Key.Date <= end.Date)
                .OrderBy(kv => kv.Key.Date)
                .Select(kv => new SeriesPoint(kv.Key.Date, kv.Value))
                .ToList();
            return res;
        }
    }
}
