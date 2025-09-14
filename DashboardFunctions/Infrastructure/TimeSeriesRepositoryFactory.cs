using DashboardFunctions.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace DashboardFunctions.Infrastructure
{
    public interface ITimeSeriesRepositoryFactory
    {
        ITimeSeriesRepository Resolve();
    }

    internal sealed class TimeSeriesRepositoryFactory : ITimeSeriesRepositoryFactory
    {
        private readonly IServiceProvider _sp;
        private readonly IRequestContextAccessor _rc;

        public TimeSeriesRepositoryFactory(IServiceProvider sp, IRequestContextAccessor rc)
        {
            _sp = sp; _rc = rc;
        }

        public ITimeSeriesRepository Resolve()
        {
            if (_rc.Current.UseMockRepo)
                return _sp.GetRequiredService<InMemoryTimeSeriesRepository>();
            return _sp.GetRequiredService<BlobCsvTimeSeriesRepository>();
        }
    }

}
