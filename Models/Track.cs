namespace MusicWeb.Models;

public partial class Track
{
    public int Id { get; set; }

    public int AlbumId { get; set; }

    public int Index { get; set; }

    public string Title { get; set; } = null!;

    public string? DownloadUrl320 { get; set; }

    public string? DownloadUrl128 { get; set; }

    public string? StreamUrl { get; set; }

    public virtual Album Album { get; set; } = null!;
}
