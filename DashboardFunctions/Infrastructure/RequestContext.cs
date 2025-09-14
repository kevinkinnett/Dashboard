namespace DashboardFunctions.Infrastructure
{
    public sealed class RequestContext
    {
        public bool UseMockClient { get; init; }
        public bool UseMockRepo { get; init; }
        // Optional extensibility: carry arbitrary testing payloads, etc.
        public string? MockSeed { get; init; }
    }

    public interface IRequestContextAccessor
    {
        RequestContext Current { get; }
        void Set(RequestContext context);
    }

    internal sealed class RequestContextAccessor : IRequestContextAccessor
    {
        private static readonly AsyncLocal<RequestContext?> _current = new();
        public RequestContext Current => _current.Value ?? _default;
        private static readonly RequestContext _default = new() { UseMockClient = false, UseMockRepo = false };

        public void Set(RequestContext context) => _current.Value = context;
    }

}
