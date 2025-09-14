using Microsoft.Extensions.DependencyInjection;

namespace DashboardFunctions.Infrastructure
{
    public interface ISeriesClientFactory<T>
    {
        ISeriesClient<T> Resolve();
    }

    internal sealed class SeriesClientFactory(IServiceProvider sp, IRequestContextAccessor rc) : ISeriesClientFactory<decimal?>
    {
        public ISeriesClient<decimal?> Resolve()
        {
            if (rc.Current.UseMockClient)
                return sp.GetRequiredService<StubSeriesClient>();
            return sp.GetRequiredService<FredClient>();
        }
    }

}
