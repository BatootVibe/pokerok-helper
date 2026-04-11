import { useNavigate } from 'react-router-dom';

export function HeaderBack({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        ←
      </button>
      <h1 style={{
        fontSize: 22,
        fontWeight: 700,
        margin: 0,
        color: 'var(--accent-gold)',
        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
      }}>
        {title}
      </h1>
    </div>
  );
}
