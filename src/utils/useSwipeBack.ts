import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to detect swipe from the left edge of the screen.
 * Triggers navigate(-1) if swipe distance > threshold.
 */
export function useSwipeBack(threshold = 30) {
  const navigate = useNavigate();
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch is near the left edge (e.g., within 40px)
      if (e.touches.length > 0 && e.touches[0].clientX < 40) {
        startXRef.current = e.touches[0].clientX;
        startYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const deltaX = currentX - startXRef.current;
      const deltaY = currentY - startYRef.current;

      // Check if movement is primarily horizontal and to the right
      if (deltaX > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        navigate(-1);
        // Haptic feedback
        try {
          window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
        } catch (err) {
          // ignore
        }
        // Reset to prevent multiple triggers
        startXRef.current = null;
        startYRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      startXRef.current = null;
      startYRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate, threshold]);
}
