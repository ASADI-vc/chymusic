namespace MusicWeb.Data;

public class Playlist
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<PlaylistTrack> Tracks { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? CoverImageUrl { get; set; }
}

public class PlaylistTrack
{
    public int AlbumId { get; set; }
    public int TrackId { get; set; }
    public int Index { get; set; }
    public string Title { get; set; } = string.Empty;
    public string AlbumTitle { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? RemoteUrl { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}