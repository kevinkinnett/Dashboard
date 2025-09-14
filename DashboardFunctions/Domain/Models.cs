namespace DashboardFunctions.Domain
{
    public readonly record struct DateRange(DateTime Start, DateTime End)
    {
        public DateRange Normalize() => Start <= End ? this : new DateRange(End, Start);
        public DateRange Intersect(DateRange other)
        {
            var s = Start > other.Start ? Start : other.Start;
            var e = End < other.End ? End : other.End;
            return s <= e ? new DateRange(s, e) : default;
        }
        public bool IsEmpty => End < Start;
    }

    /// <summary>Generic observation of a numeric daily time-series.</summary>
    public sealed record Observation<T>(string SeriesId, DateTime Date, T? Value);

    /// <summary>Lightweight point (date, value) used by read-side operations and charts.</summary>
    public sealed record SeriesPoint(DateTime Date, decimal? Value);

    /// <summary>For the inversion use-case, A, B, and Spread points.</summary>
    public sealed record InversionPoint(DateTime Date, decimal? SeriesA, decimal? SeriesB, decimal? Spread);
}
