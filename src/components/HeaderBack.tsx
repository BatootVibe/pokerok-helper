import { useNavigate } from 'react-router-dom';
import { useSwipeBack } from '../utils/useSwipeBack';

export function HeaderBack({ title }: { title: string }) {
  useSwipeBack();

  return (
    <div className="page-header">
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
