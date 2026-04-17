using Microsoft.JSInterop;
using MusicWeb.Data;

namespace MusicWeb.Services;

public sealed class PlaybackService(IJSRuntime jsRuntime)
{
    private IReadOnlyList<MusicTrack> _queue = [];
    private MusicAlbum? _queueAlbum;
    private int _queueIndex = -1;

    public event Action? StateChanged;

    public MusicAlbum? CurrentAlbum { get; private set; }

    public MusicTrack? CurrentTrack { get; private set; }

    public string? CurrentSourceUrl { get; private set; }

    public bool IsPreparing { get; private set; }

    public bool IsCaching { get; private set; }

    public bool IsCached { get; private set; }

    public bool PlaybackBlocked { get; private set; }

    public string? PlaybackError { get; private set; }

    public int PlaybackVersion { get; private set; }

    public bool HasPrevious => _queueIndex > 0;

    public bool HasNext => _queueIndex >= 0 && _queueIndex < _queue.Count - 1;

    public async Task PlayAlbumAsync(MusicAlbum album, int startTrackIndex = 0)
    {
        var queue = album.Tracks
            .Where(track => track.HasSource)
            .OrderBy(track => track.Index)
            .ToList();

        if (queue.Count == 0)
        {
            return;
        }

        _queueAlbum = album;
        await PlayQueueAsync(queue, Math.Clamp(startTrackIndex, 0, queue.Count - 1));
    }

    public async Task PlayTrackAsync(MusicAlbum album, int trackId)
    {
        var queue = album.Tracks
            .Where(item => item.HasSource)
            .OrderBy(item => item.Index)
            .ToList();

        if (queue.Count == 0)
        {
            return;
        }

        _queueAlbum = album;
        var startIndex = Math.Max(0, queue.FindIndex(item => item.Id == trackId));
        await PlayQueueAsync(queue, startIndex);
    }

    public async Task PlayQueueAsync(IReadOnlyList<MusicTrack> queue, int startIndex)
    {
        if (queue.Count == 0 || _queueAlbum is null)
        {
            return;
        }

        _queue = queue;
        _queueIndex = Math.Clamp(startIndex, 0, queue.Count - 1);
        await SelectCurrentAsync(_queueAlbum, _queue[_queueIndex]);
    }

    public async Task PlayNextAsync()
    {
        if (!HasNext || _queueAlbum is null)
        {
            return;
        }

        _queueIndex++;
        await SelectCurrentAsync(_queueAlbum, _queue[_queueIndex]);
    }

    public async Task PlayPreviousAsync()
    {
        if (!HasPrevious || _queueAlbum is null)
        {
            return;
        }

        _queueIndex--;
        await SelectCurrentAsync(_queueAlbum, _queue[_queueIndex]);
    }

    public async Task HandleTrackEndedAsync()
    {
        if (HasNext)
        {
            await PlayNextAsync();
        }
    }

    public Task ReportPlaybackErrorAsync()
    {
        PlaybackBlocked = true;
        PlaybackError = "The music host blocked in-page playback for this track. Try opening the direct file in a new tab or use a source that allows embedded streaming.";
        NotifyStateChanged();
        return Task.CompletedTask;
    }

    private async Task SelectCurrentAsync(MusicAlbum album, MusicTrack track)
    {
        CurrentAlbum = album;
        CurrentTrack = track;
        IsPreparing = true;
        IsCaching = false;
        IsCached = false;
        PlaybackBlocked = false;
        PlaybackError = null;
        CurrentSourceUrl = null;
        PlaybackVersion++;
        NotifyStateChanged();

        var remoteUrl = track.PreferredUrl;
        var cachedUrl = await jsRuntime.InvokeAsync<string?>("musicCache.getPlayableUrl", track.Id, remoteUrl);

        IsCached = !string.IsNullOrWhiteSpace(cachedUrl);
        CurrentSourceUrl = cachedUrl ?? remoteUrl;
        IsPreparing = false;
        PlaybackVersion++;
        NotifyStateChanged();

        _ = PrefetchAsync(track.Id, remoteUrl);
    }

    private async Task PrefetchAsync(int trackId, string remoteUrl)
    {
        if (string.IsNullOrWhiteSpace(remoteUrl))
        {
            return;
        }

        IsCaching = true;
        NotifyStateChanged();

        try
        {
            var cached = await jsRuntime.InvokeAsync<bool>("musicCache.prefetchTrack", trackId, remoteUrl);
            IsCached = cached;
        }
        catch
        {
            // Ignore cache failures and keep streaming from the network.
        }
        finally
        {
            IsCaching = false;
            NotifyStateChanged();
        }
    }
    
    public async Task<bool> RequestFolderAccessAsync()
    {
        return await jsRuntime.InvokeAsync<bool>("musicCache.requestFolderAccess");
    }

    public async Task<bool> IsFolderAccessGrantedAsync()
    {
        return await jsRuntime.InvokeAsync<bool>("musicCache.isFolderAccessGranted");
    }
    
    public async Task<bool> IsFileSystemAccessSupportedAsync()
    {
        try
        {
            return await jsRuntime.InvokeAsync<bool>("musicCache.isFileSystemAccessSupported");
        }
        catch
        {
            return false;
        }
    }

    private void NotifyStateChanged() => StateChanged?.Invoke();
}
