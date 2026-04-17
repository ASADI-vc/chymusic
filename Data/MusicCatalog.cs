namespace MusicWeb.Data;

public sealed class MusicCatalogOverview
{
    public int AlbumCount { get; set; }

    public int TrackCount { get; set; }

    public int GenreCount { get; set; }

    public List<MusicAlbumSummary> Albums { get; set; } = [];
}

public class MusicAlbumSummary
{
    public int Id { get; set; }

    public string TitleFa { get; set; } = string.Empty;

    public string? AlbumName { get; set; }

    public string? ArtistName { get; set; }

    public string? CoverImageUrl { get; set; }

    public string? PublishedAt { get; set; }

    public int TracksCount { get; set; }

    public string? Genre { get; set; }

    public int LikeCount { get; set; }

    public int CommentCount { get; set; }

    public string DisplayTitle => string.IsNullOrWhiteSpace(AlbumName) ? TitleFa : AlbumName!;

    public string DisplayArtist => string.IsNullOrWhiteSpace(ArtistName) ? "Unknown artist" : ArtistName!;
}

public sealed class MusicAlbum : MusicAlbumSummary
{
    public string SlugUrl { get; set; } = string.Empty;

    public string? DescriptionText { get; set; }

    public string? Released { get; set; }

    public string? Format { get; set; }

    public int DislikeCount { get; set; }

    public string? ZipDownloadUrl { get; set; }

    public double? ZipSizeMb { get; set; }

    public List<string> Categories { get; set; } = [];

    public List<string> Tags { get; set; } = [];

    public List<MusicTrack> Tracks { get; set; } = [];
}

public sealed class MusicTrack
{
    public int Id { get; set; }

    public int Index { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? DownloadUrl320 { get; set; }

    public string? DownloadUrl128 { get; set; }

    public string? StreamUrl { get; set; }

    public string PreferredUrl => DownloadUrl320 ?? StreamUrl ?? DownloadUrl128 ?? string.Empty;

    public bool HasSource => !string.IsNullOrWhiteSpace(PreferredUrl);
}

public sealed class MusicTrackSummary
{
    public int AlbumId { get; set; }

    public int TrackId { get; set; }

    public int Index { get; set; }

    public string Title { get; set; } = string.Empty;

    public string AlbumTitle { get; set; } = string.Empty;

    public string Artist { get; set; } = string.Empty;

    public string? Genre { get; set; }

    public string? CoverImageUrl { get; set; }
}

public sealed class FeaturedAlbumsPayload
{
    public List<MusicAlbumSummary> Albums { get; set; } = [];
}

public sealed class FreshTracksPayload
{
    public List<MusicTrackSummary> Tracks { get; set; } = [];
}

public sealed class MusicSearchResult
{
    public List<MusicAlbumSearchResult> Albums { get; set; } = [];

    public List<MusicTrackSearchResult> Tracks { get; set; } = [];
}

public sealed class MusicAlbumSearchResult
{
    public int AlbumId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Artist { get; set; } = string.Empty;

    public string? Genre { get; set; }

    public string? CoverImageUrl { get; set; }
}

public sealed class MusicTrackSearchResult
{
    public int AlbumId { get; set; }

    public int TrackId { get; set; }

    public int Index { get; set; }

    public string Title { get; set; } = string.Empty;

    public string AlbumTitle { get; set; } = string.Empty;

    public string Artist { get; set; } = string.Empty;

    public string? Genre { get; set; }

    public string? CoverImageUrl { get; set; }
}
