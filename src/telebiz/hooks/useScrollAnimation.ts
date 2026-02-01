import { useEffect, useState } from '../../lib/teact/teact';

import type { RefObject } from 'react';

export function useScrollAnimation(ref: RefObject<HTMLElement | undefined>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}
