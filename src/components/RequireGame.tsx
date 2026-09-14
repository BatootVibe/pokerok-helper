import { Navigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

interface RequireGameProps {
  children: React.ReactNode;
}

/**
 * Route guard — редиректит на главную, если нет активной игры.
 */
export function RequireGame({ children }: RequireGameProps) {
  const { currentGame } = useGame();

  if (!currentGame) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
