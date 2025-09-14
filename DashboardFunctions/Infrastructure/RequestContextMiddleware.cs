using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace DashboardFunctions.Infrastructure
{
    internal sealed class RequestContextMiddleware(IRequestContextAccessor accessor) : IFunctionsWorkerMiddleware
    {
        public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
        {
            // Works for HTTP-triggered functions; returns null for non-HTTP triggers.
            var req = await context.GetHttpRequestDataAsync();

            var ctx = new RequestContext
            {
                UseMockRepo = FromHeader("X-Mock-Repo") || FromQuery("mockRepo"),
                UseMockClient = FromHeader("X-Mock-Client") || FromQuery("mockClient"),
                MockSeed = GetHeaderString("X-Mock-Seed") ?? FromQueryString("mockSeed"),
            };

            accessor.Set(ctx);
            await next(context);
            return;

            bool FromHeader(string name)
            {
                if (req is null) return false;
                return req.Headers.TryGetValues(name, out var values) &&
                       values.Any(v => v.Equals("true", StringComparison.OrdinalIgnoreCase) || v == "1");
            }

            string? GetHeaderString(string name)
            {
                if (req is null) return null;
                return req.Headers.TryGetValues(name, out var values) ? values.FirstOrDefault() : null;
            }

            bool FromQuery(string key)
            {
                if (req is null) return false;
                var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                var v = q.Get(key);
                return v is not null &&
                       (v.Equals("true", StringComparison.OrdinalIgnoreCase) || v == "1");
            }

            string? FromQueryString(string key)
            {
                if (req is null) return null;
                var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                return q.Get(key);
            }
        }
    }
}
