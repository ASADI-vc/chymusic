import { useParams } from 'react-router-dom';

export function ArtistPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <h1 className="page__title">Artist</h1>
      <p className="page__subtitle">Artist view for {id}. (Coming in next iteration.)</p>
    </div>
  );
}
