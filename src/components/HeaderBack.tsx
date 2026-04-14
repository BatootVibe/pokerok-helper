import { useNavigate } from 'react-router-dom';

export function HeaderBack({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      <button className="back-btn" onClick={() => navigate(-1)}>←</button>
      <h1 className="page-subtitle">{title}</h1>
    </div>
  );
}

export function HeaderHome({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      <button className="back-btn" onClick={() => navigate('/')}>←</button>
      <h1 className="page-subtitle">{title}</h1>
    </div>
  );
}
