namespace MusicWeb.Models;

public partial class AlbumTag
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public virtual ICollection<Album> Albums { get; set; } = new List<Album>();
}
