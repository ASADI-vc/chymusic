using Microsoft.JSInterop;
using MusicWeb.Data;
using System.Text.Json;

namespace MusicWeb.Services;

public class PlaylistService
{
    private readonly IJSRuntime _js;
    private readonly MusicCatalogService _catalogService;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PlaylistService(IJSRuntime js, MusicCatalogService catalogService)
    {
        _js = js;
        _catalogService = catalogService;
    }

    public async Task<List<Playlist>> GetAllPlaylistsAsync()
    {
        try
        {
            var json = await _js.InvokeAsync<string>("playlistStorage.getAllPlaylists");
            return JsonSerializer.Deserialize<List<Playlist>>(json, _jsonOptions) ?? new();
        }
        catch
        {
            return new();
        }
    }

    public async Task<Playlist?> GetPlaylistAsync(string id)
    {
        try
        {
            var json = await _js.InvokeAsync<string>("playlistStorage.getPlaylist", id);
            return JsonSerializer.Deserialize<Playlist>(json, _jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    public async Task SavePlaylistAsync(Playlist playlist)
    {
        playlist.UpdatedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(playlist, _jsonOptions);
        await _js.InvokeVoidAsync("playlistStorage.savePlaylist", json);
    }

    public async Task DeletePlaylistAsync(string id)
    {
        await _js.InvokeVoidAsync("playlistStorage.deletePlaylist", id);
    }

    public async Task<bool> AddTrackToPlaylistAsync(string playlistId, MusicTrack track, MusicAlbum album)
    {
        var playlist = await GetPlaylistAsync(playlistId);
        if (playlist == null) return false;

        if (playlist.Tracks.Any(t => t.TrackId == track.Id)) return true;

        playlist.Tracks.Add(new PlaylistTrack
        {
            AlbumId = album.Id,
            TrackId = track.Id,
            Index = track.Index,
            Title = track.Title,
            AlbumTitle = album.DisplayTitle,
            Artist = album.ArtistName ?? "",
            CoverImageUrl = album.CoverImageUrl,
            RemoteUrl = track.PreferredUrl,
            AddedAt = DateTime.UtcNow
        });

        await SavePlaylistAsync(playlist);
        return true;
    }

    public async Task<bool> RemoveTrackFromPlaylistAsync(string playlistId, int trackId)
    {
        var playlist = await GetPlaylistAsync(playlistId);
        if (playlist == null) return false;

        var removed = playlist.Tracks.RemoveAll(t => t.TrackId == trackId) > 0;
        if (removed) await SavePlaylistAsync(playlist);
        return removed;
    }

    public async Task<Playlist> CreatePlaylistAsync(string name, string? description = null)
    {
        var playlist = new Playlist
        {
            Name = name,
            Description = description,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await SavePlaylistAsync(playlist);
        return playlist;
    }
}