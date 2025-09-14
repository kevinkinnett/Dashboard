using DashboardFunctions.Infrastructure;
using DashboardFunctions.Repositories;
using DashboardFunctions.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Net.Http.Headers;

var host = Host.CreateDefaultBuilder()
    .ConfigureFunctionsWebApplication(builder =>
    {
        builder.UseMiddleware<RequestContextMiddleware>();
    })
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((ctx, services) =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        // Configure cache + Fred
        services.Configure<StorageCacheOptions>(ctx.Configuration.GetSection("StorageCache"));
        services.Configure<FredOptions>(ctx.Configuration.GetSection("Fred"));

        // --- Request context & middleware ---
        services.AddSingleton<IRequestContextAccessor, RequestContextAccessor>();
        // Factories depend on IServiceProvider + IRequestContextAccessor
        services.AddScoped<ISeriesClientFactory<decimal?>, SeriesClientFactory>();
        services.AddScoped<ITimeSeriesRepositoryFactory, TimeSeriesRepositoryFactory>();

        // Register concrete implementations (both real & mock)
        // Real FRED HTTP client
        services.AddHttpClient<FredClient>((sp, http) =>
        {
            var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<FredOptions>>().Value;
            http.BaseAddress = new Uri(opts.BaseUrl ?? "https://api.stlouisfed.org");
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            http.Timeout = TimeSpan.FromSeconds(30);
        });
        services.AddScoped<ISeriesClient<decimal?>, FredClient>(); // default registration (also resolved by factory)
        services.AddScoped<StubSeriesClient>();

        // Blob CSV repo + in-memory mock
        services.AddScoped<BlobCsvTimeSeriesRepository>();
        services.AddScoped<InMemoryTimeSeriesRepository>();

        // Shared services
        services.AddScoped<IRangeService, RangeService>();
        services.AddScoped<IInversionService, InversionService>();
        services.AddScoped<ITimeSeriesFetchOrchestrator, TimeSeriesFetchOrchestrator>();
    })
    .Build();

host.Run();


