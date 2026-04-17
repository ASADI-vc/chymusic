using System.Net.Http.Json;
using System.Text.Json;
using MusicWeb.Data;

namespace MusicWeb.Services;

public sealed class MusicCatalogService(HttpClient httpClient)
{
    private readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private MusicCatalogOverview? _overview;
    private readonly Dictionary<int, MusicAlbum> _albumCache = [];

    public async Task<MusicCatalogOverview> GetOverviewAsync()
    {
        if (_overview is not null)
        {
            return _overview;
        }

        _overview = await httpClient.GetFromJsonAsync<MusicCatalogOverview>("data/catalog-summary.json", _serializerOptions)
            ?? new MusicCatalogOverview();

        return _overview;
    }

    public async Task<IReadOnlyList<MusicAlbumSummary>> GetFeaturedAlbumsAsync()
    {
        var payload = await httpClient.GetFromJsonAsync<FeaturedAlbumsPayload>("data/featured.json", _serializerOptions)
            ?? new FeaturedAlbumsPayload();
        return payload.Albums;
    }

    public async Task<IReadOnlyList<MusicTrackSummary>> GetFreshTracksAsync()
    {
        var payload = await httpClient.GetFromJsonAsync<FreshTracksPayload>("data/fresh-tracks.json", _serializerOptions)
            ?? new FreshTracksPayload();
        return payload.Tracks;
    }

    public async Task<MusicAlbum?> GetAlbumAsync(int id)
    {
        if (_albumCache.TryGetValue(id, out var cached))
        {
            return cached;
        }

        var album = await httpClient.GetFromJsonAsync<MusicAlbum>($"data/albums/{id}.json", _serializerOptions);
        if (album is not null)
        {
            _albumCache[id] = album;
        }

        return album;
    }
}
