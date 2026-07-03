import { useParams } from 'react-router-dom';

export function AlbumPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <h1 className="page__title">Album</h1>
      <p className="page__subtitle">Album view for {id}. (Coming in next iteration.)</p>
    </div>
  );
}
