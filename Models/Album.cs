namespace MusicWeb.Models;

public partial class Album
{
    public int Id { get; set; }

    public int? WpPostId { get; set; }

    public string TitleFa { get; set; } = null!;

    public string? AlbumName { get; set; }

    public string? ArtistName { get; set; }

    public string SlugUrl { get; set; } = null!;

    public string? CoverImageUrl { get; set; }

    public string? DescriptionHtml { get; set; }

    public string? DescriptionText { get; set; }

    public string? Author { get; set; }

    public string? PublishedAt { get; set; }

    public string? Released { get; set; }

    public int? TracksCount { get; set; }

    public string? Format { get; set; }

    public string? Genre { get; set; }

    public int LikeCount { get; set; }

    public int DislikeCount { get; set; }

    public int CommentCount { get; set; }

    public string? ZipDownloadUrl { get; set; }

    public double? ZipSizeMb { get; set; }

    public string? ShortUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Track> Tracks { get; set; } = new List<Track>();

    public virtual ICollection<AlbumCategory> Categories { get; set; } = new List<AlbumCategory>();

    public virtual ICollection<AlbumTag> Tags { get; set; } = new List<AlbumTag>();
}
