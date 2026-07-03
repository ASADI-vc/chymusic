import { useParams } from 'react-router-dom';

export function PlaylistPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <h1 className="page__title">Playlist</h1>
      <p className="page__subtitle">Playlist view for {id}. (Coming in next iteration.)</p>
    </div>
  );
}
