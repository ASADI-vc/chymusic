using Microsoft.JSInterop;
using MusicWeb.Data;

namespace MusicWeb.Services;

public sealed class PlaybackService(IJSRuntime jsRuntime)
{
    private List<MusicTrack> _queue = [];
    private int _queueIndex = -1;
    private bool _shuffleEnabled;
    private readonly Random _random = new();
    private MusicAlbum? _currentAlbum; // Album context for display only

    public event Action? StateChanged;
    public event Action? QueueChanged;

    public MusicAlbum? CurrentAlbum { get; private set; }
    public MusicTrack? CurrentTrack { get; private set; }
    public string? CurrentSourceUrl { get; private set; }
    public bool IsPreparing { get; private set; }
    public bool IsCaching { get; private set; }
    public bool IsCached { get; private set; }
    public bool PlaybackBlocked { get; private set; }
    public string? PlaybackError { get; private set; }
    public int PlaybackVersion { get; private set; }

    public bool ShuffleEnabled
    {
        get => _shuffleEnabled;
        set
        {
            if (_shuffleEnabled == value) return;
            _shuffleEnabled = value;
            if (_queue.Count > 0)
            {
                // Keep current track at position, shuffle the rest
                var currentTrack = CurrentTrack;
                var remaining = _queue.Skip(_queueIndex + 1).ToList();
                ShuffleList(remaining);
                _queue = _queue.Take(_queueIndex + 1).Concat(remaining).ToList();
            }
            NotifyStateChanged();
            NotifyQueueChanged();
        }
    }

    public IReadOnlyList<MusicTrack> Queue => _queue.AsReadOnly();
    public int QueueIndex => _queueIndex;
    public bool HasPrevious => _queueIndex > 0;
    public bool HasNext => _queueIndex < _queue.Count - 1;

    // ---------- Core Playback ----------
    public async Task PlayNowAsync(IEnumerable<MusicTrack> tracks, int startIndex = 0, MusicAlbum? albumContext = null)
    {
        var trackList = tracks.Where(t => t.HasSource).ToList();
        if (trackList.Count == 0) return;

        _queue = trackList;
        _currentAlbum = albumContext;
        _queueIndex = Math.Clamp(startIndex, 0, _queue.Count - 1);
        if (_shuffleEnabled)
        {
            // Shuffle everything after the start index
            var remaining = _queue.Skip(_queueIndex + 1).ToList();
            ShuffleList(remaining);
            _queue = _queue.Take(_queueIndex + 1).Concat(remaining).ToList();
        }
        await SelectCurrentAsync(_queue[_queueIndex]);
        NotifyQueueChanged();
    }

    public async Task AddToQueueAsync(IEnumerable<MusicTrack> tracks, MusicAlbum? albumContext = null)
    {
        var trackList = tracks.Where(t => t.HasSource).ToList();
        if (trackList.Count == 0) return;

        // Fill missing display properties from album context
        if (albumContext != null)
        {
            foreach (var t in trackList)
            {
                t.Artist ??= albumContext.DisplayArtist ?? albumContext.ArtistName;
                t.AlbumTitle ??= albumContext.DisplayTitle;
                t.CoverImageUrl ??= albumContext.CoverImageUrl;
            }
        }

        _queue.AddRange(trackList);
        if (_shuffleEnabled && _queueIndex >= 0)
        {
            var newItems = _queue.Skip(_queue.Count - trackList.Count).ToList();
            ShuffleList(newItems);
            _queue = _queue.Take(_queue.Count - trackList.Count).Concat(newItems).ToList();
        }
        NotifyQueueChanged();
        if (CurrentTrack == null && _queue.Count > 0)
        {
            _queueIndex = 0;
            await SelectCurrentAsync(_queue[0]);
        }
    }

    public async Task PlayNextAsync()
    {
        if (!HasNext) return;
        _queueIndex++;
        await SelectCurrentAsync(_queue[_queueIndex]);
        NotifyQueueChanged();
    }

    public async Task PlayPreviousAsync()
    {
        if (!HasPrevious) return;
        _queueIndex--;
        await SelectCurrentAsync(_queue[_queueIndex]);
        NotifyQueueChanged();
    }

    public async Task SkipToQueueItemAsync(int index)
    {
        if (index < 0 || index >= _queue.Count) return;
        _queueIndex = index;
        await SelectCurrentAsync(_queue[_queueIndex]);
        NotifyQueueChanged();
    }

    public void RemoveFromQueue(int index)
    {
        if (index < 0 || index >= _queue.Count) return;
        if (index == _queueIndex)
        {
            // Removing current track: stop playback, play next if available
            _queue.RemoveAt(index);
            if (_queue.Count == 0)
            {
                _queueIndex = -1;
                CurrentTrack = null;
                CurrentSourceUrl = null;
            }
            else
            {
                if (index >= _queue.Count) _queueIndex = _queue.Count - 1;
                _ = SelectCurrentAsync(_queue[_queueIndex]);
            }
        }
        else if (index < _queueIndex)
        {
            _queue.RemoveAt(index);
            _queueIndex--;
        }
        else
        {
            _queue.RemoveAt(index);
        }
        NotifyQueueChanged();
        NotifyStateChanged();
    }

    public void ClearQueue()
    {
        _queue.Clear();
        _queueIndex = -1;
        CurrentTrack = null;
        CurrentAlbum = null;
        CurrentSourceUrl = null;
        _currentAlbum = null;
        NotifyQueueChanged();
        NotifyStateChanged();
    }

    public void MoveQueueItem(int fromIndex, int toIndex)
    {
        if (fromIndex < 0 || fromIndex >= _queue.Count || toIndex < 0 || toIndex >= _queue.Count) return;
        var item = _queue[fromIndex];
        _queue.RemoveAt(fromIndex);
        _queue.Insert(toIndex, item);

        // Adjust current index
        if (fromIndex == _queueIndex) _queueIndex = toIndex;
        else if (fromIndex < _queueIndex && toIndex >= _queueIndex) _queueIndex--;
        else if (fromIndex > _queueIndex && toIndex <= _queueIndex) _queueIndex++;

        NotifyQueueChanged();
    }

    // ---------- Convenience Methods ----------
    public Task PlayAlbumAsync(MusicAlbum album, int startTrackIndex = 0) =>
        PlayNowAsync(album.Tracks.OrderBy(t => t.Index), startTrackIndex, album);

    public Task PlayTrackAsync(MusicAlbum album, int trackId)
    {
        var track = album.Tracks.FirstOrDefault(t => t.Id == trackId);
        if (track == null) return Task.CompletedTask;
        var allTracks = album.Tracks.OrderBy(t => t.Index).ToList();
        var startIndex = allTracks.FindIndex(t => t.Id == trackId);
        return PlayNowAsync(allTracks, startIndex, album);
    }

    public Task PlayPlaylistAsync(Playlist playlist, int startIndex = 0)
    {
        var tracks = playlist.Tracks.Select(pt => new MusicTrack
        {
            Id = pt.TrackId,
            Index = pt.Index,
            Title = pt.Title,
            StreamUrl = pt.RemoteUrl ?? string.Empty,
            // For display purposes
            AlbumId = pt.AlbumId,
            AlbumTitle = pt.AlbumTitle,
            Artist = pt.Artist,
            CoverImageUrl = pt.CoverImageUrl
        }).ToList();

        var dummyAlbum = new MusicAlbum
        {
            Id = 0,
            TitleFa = playlist.Name,
            ArtistName = "Various Artists",
            CoverImageUrl = playlist.CoverImageUrl,
            Tracks = tracks
        };
        return PlayNowAsync(tracks, startIndex, dummyAlbum);
    }

    // ---------- Private Helpers ----------
    private async Task SelectCurrentAsync(MusicTrack track)
    {
        CurrentAlbum = _currentAlbum;
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
        if (string.IsNullOrWhiteSpace(remoteUrl)) return;
        IsCaching = true;
        NotifyStateChanged();
        try
        {
            var cached = await jsRuntime.InvokeAsync<bool>("musicCache.prefetchTrack", trackId, remoteUrl);
            IsCached = cached;
        }
        catch { }
        finally
        {
            IsCaching = false;
            NotifyStateChanged();
        }
    }

    private void ShuffleList<T>(IList<T> list)
    {
        int n = list.Count;
        while (n > 1)
        {
            n--;
            int k = _random.Next(n + 1);
            (list[k], list[n]) = (list[n], list[k]);
        }
    }

    public async Task HandleTrackEndedAsync()
    {
        if (HasNext)
            await PlayNextAsync();
        else
            ClearQueue(); // End of queue
    }

    public Task ReportPlaybackErrorAsync()
    {
        PlaybackBlocked = true;
        PlaybackError = "The music host blocked in-page playback for this track. Try opening the direct file in a new tab or use a source that allows embedded streaming.";
        NotifyStateChanged();
        return Task.CompletedTask;
    }

    private void NotifyStateChanged() => StateChanged?.Invoke();
    private void NotifyQueueChanged() => QueueChanged?.Invoke();

    // File system access methods remain unchanged...
    public async Task<bool> RequestFolderAccessAsync() => await jsRuntime.InvokeAsync<bool>("musicCache.requestFolderAccess");
    public async Task<bool> IsFolderAccessGrantedAsync() => await jsRuntime.InvokeAsync<bool>("musicCache.isFolderAccessGranted");
    public async Task<bool> IsFileSystemAccessSupportedAsync()
    {
        try { return await jsRuntime.InvokeAsync<bool>("musicCache.isFileSystemAccessSupported"); }
        catch { return false; }
    }
    public async Task<bool> ReconnectFolderAsync()
    {
        try { return await jsRuntime.InvokeAsync<bool>("musicCache.reconnectFolder"); }
        catch { return false; }
    }
    public async Task<bool> HasStoredHandleAsync()
    {
        try { return await jsRuntime.InvokeAsync<bool>("musicCache.hasStoredHandle"); }
        catch { return false; }
    }
}