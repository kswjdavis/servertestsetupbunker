import { useEffect, useRef } from 'react';

export function usePoll(callback: () => void | Promise<void>, interval: number, enabled: boolean = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      try {
        await savedCallback.current();
      } catch (error) {
        // Don't let errors break the polling loop
        console.error('Polling callback error:', error);
      }
    };

    // Call immediately
    tick();

    // Then poll at interval
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}