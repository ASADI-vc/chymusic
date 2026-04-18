using System.Net.Http.Json;
using System.Text.Json;
using MusicWeb.Data;

namespace MusicWeb.Services;

public sealed class MusicCatalogService(HttpClient httpClient)
{
    private static readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private MusicCatalogOverview? _overview;
    private readonly Dictionary<int, MusicAlbum> _albumCache = [];

    public async Task<MusicCatalogOverview> GetOverviewAsync()
    {
        if (_overview is not null)
            return _overview;

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
            return cached;

        var album = await httpClient.GetFromJsonAsync<MusicAlbum>($"data/albums/{id}.json", _serializerOptions);
        if (album is not null)
            _albumCache[id] = album;

        return album;
    }

    // Genre methods – now using the list data
    public async Task<List<string>> GetGenresAsync()
    {
        var overview = await GetOverviewAsync();
        return overview.Albums
            .SelectMany(a => a.Genre)
            .Distinct()
            .OrderBy(g => g)
            .ToList();
    }

    public async Task<List<MusicAlbumSummary>> GetAlbumsByGenreAsync(string genre)
    {
        var overview = await GetOverviewAsync();
        return overview.Albums
            .Where(a => a.Genre.Any(g => string.Equals(g, genre, StringComparison.OrdinalIgnoreCase)))
            .ToList();
    }

    public async Task<List<MusicTrackSummary>> GetTracksByGenreAsync(string genre)
    {
        var albums = await GetAlbumsByGenreAsync(genre);
        var tracks = new List<MusicTrackSummary>();
        foreach (var album in albums)
        {
            var fullAlbum = await GetAlbumAsync(album.Id);
            if (fullAlbum != null)
            {
                tracks.AddRange(fullAlbum.Tracks.Select(t => new MusicTrackSummary
                {
                    AlbumId = fullAlbum.Id,
                    TrackId = t.Id,
                    Index = t.Index,
                    Title = t.Title,
                    AlbumTitle = fullAlbum.DisplayTitle,
                    Artist = fullAlbum.DisplayArtist,
                    Genre = string.Join(", ", fullAlbum.Genre),
                    CoverImageUrl = fullAlbum.CoverImageUrl
                }));
            }
        }
        return tracks;
    }

    // Artist methods – now using the list data
    public async Task<List<string>> GetArtistsAsync()
    {
        var overview = await GetOverviewAsync();
        return overview.Albums
            .SelectMany(a => a.ArtistName)
            .Distinct()
            .OrderBy(ar => ar)
            .ToList();
    }

    public async Task<List<MusicAlbumSummary>> GetAlbumsByArtistAsync(string artist)
    {
        var overview = await GetOverviewAsync();
        return overview.Albums
            .Where(a => a.ArtistName.Any(ar => string.Equals(ar, artist, StringComparison.OrdinalIgnoreCase)))
            .ToList();
    }

    public async Task<List<MusicTrackSummary>> GetTracksByArtistAsync(string artist)
    {
        var albums = await GetAlbumsByArtistAsync(artist);
        var tracks = new List<MusicTrackSummary>();
        foreach (var album in albums)
        {
            var fullAlbum = await GetAlbumAsync(album.Id);
            if (fullAlbum != null)
            {
                tracks.AddRange(fullAlbum.Tracks.Select(t => new MusicTrackSummary
                {
                    AlbumId = fullAlbum.Id,
                    TrackId = t.Id,
                    Index = t.Index,
                    Title = t.Title,
                    AlbumTitle = fullAlbum.DisplayTitle,
                    Artist = fullAlbum.DisplayArtist,
                    Genre = string.Join(", ", fullAlbum.Genre),
                    CoverImageUrl = fullAlbum.CoverImageUrl
                }));
            }
        }
        return tracks;
    }
}