using Microsoft.EntityFrameworkCore;

namespace MusicWeb.Models;

public partial class MusicDbContext : DbContext
{
    public MusicDbContext()
    {
    }

    public MusicDbContext(DbContextOptions<MusicDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Album> Albums { get; set; }

    public virtual DbSet<AlbumCategory> AlbumCategories { get; set; }

    public virtual DbSet<AlbumTag> AlbumTags { get; set; }

    public virtual DbSet<Track> Tracks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Album>(entity =>
        {
            entity.ToTable("albums");

            entity.HasIndex(e => e.SlugUrl, "IX_albums_slug_url").IsUnique();

            entity.HasIndex(e => e.WpPostId, "ix_albums_wp_post_id");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.AlbumName)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("album_name");
            entity.Property(e => e.ArtistName)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("artist_name");
            entity.Property(e => e.Author)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("author");
            entity.Property(e => e.CommentCount).HasColumnName("comment_count");
            entity.Property(e => e.CoverImageUrl)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("cover_image_url");
            entity.Property(e => e.CreatedAt)
                .HasColumnType("DATETIME")
                .HasColumnName("created_at");
            entity.Property(e => e.DescriptionHtml).HasColumnName("description_html");
            entity.Property(e => e.DescriptionText).HasColumnName("description_text");
            entity.Property(e => e.DislikeCount).HasColumnName("dislike_count");
            entity.Property(e => e.Format)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("format");
            entity.Property(e => e.Genre)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("genre");
            entity.Property(e => e.LikeCount).HasColumnName("like_count");
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.Released).HasColumnName("released");
            entity.Property(e => e.ShortUrl)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("short_url");
            entity.Property(e => e.SlugUrl)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("slug_url");
            entity.Property(e => e.TitleFa)
                .HasColumnType("VARCHAR(512)")
                .HasColumnName("title_fa");
            entity.Property(e => e.TracksCount).HasColumnName("tracks_count");
            entity.Property(e => e.UpdatedAt)
                .HasColumnType("DATETIME")
                .HasColumnName("updated_at");
            entity.Property(e => e.WpPostId).HasColumnName("wp_post_id");
            entity.Property(e => e.ZipDownloadUrl)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("zip_download_url");
            entity.Property(e => e.ZipSizeMb)
                .HasColumnType("FLOAT")
                .HasColumnName("zip_size_mb");

            entity.HasMany(d => d.Categories).WithMany(p => p.Albums)
                .UsingEntity<Dictionary<string, object>>(
                    "AlbumCategoryLink",
                    r => r.HasOne<AlbumCategory>().WithMany().HasForeignKey("CategoryId"),
                    l => l.HasOne<Album>().WithMany().HasForeignKey("AlbumId"),
                    j =>
                    {
                        j.HasKey("AlbumId", "CategoryId");
                        j.ToTable("album_category_link");
                        j.IndexerProperty<int>("AlbumId").HasColumnName("album_id");
                        j.IndexerProperty<int>("CategoryId").HasColumnName("category_id");
                    });

            entity.HasMany(d => d.Tags).WithMany(p => p.Albums)
                .UsingEntity<Dictionary<string, object>>(
                    "AlbumTagLink",
                    r => r.HasOne<AlbumTag>().WithMany().HasForeignKey("TagId"),
                    l => l.HasOne<Album>().WithMany().HasForeignKey("AlbumId"),
                    j =>
                    {
                        j.HasKey("AlbumId", "TagId");
                        j.ToTable("album_tag_link");
                        j.IndexerProperty<int>("AlbumId").HasColumnName("album_id");
                        j.IndexerProperty<int>("TagId").HasColumnName("tag_id");
                    });
        });

        modelBuilder.Entity<AlbumCategory>(entity =>
        {
            entity.ToTable("album_categories");

            entity.HasIndex(e => e.Name, "IX_album_categories_name").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.Name)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("name");
        });

        modelBuilder.Entity<AlbumTag>(entity =>
        {
            entity.ToTable("album_tags");

            entity.HasIndex(e => e.Name, "IX_album_tags_name").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.Name)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("name");
        });

        modelBuilder.Entity<Track>(entity =>
        {
            entity.ToTable("tracks");

            entity.HasIndex(e => e.AlbumId, "ix_tracks_album_id");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.AlbumId).HasColumnName("album_id");
            entity.Property(e => e.DownloadUrl128)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("download_url_128");
            entity.Property(e => e.DownloadUrl320)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("download_url_320");
            entity.Property(e => e.Index).HasColumnName("index");
            entity.Property(e => e.StreamUrl)
                .HasColumnType("VARCHAR(1024)")
                .HasColumnName("stream_url");
            entity.Property(e => e.Title)
                .HasColumnType("VARCHAR(255)")
                .HasColumnName("title");

            entity.HasOne(d => d.Album).WithMany(p => p.Tracks).HasForeignKey(d => d.AlbumId);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
