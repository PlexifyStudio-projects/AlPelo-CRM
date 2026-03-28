import { useEffect, useRef } from 'react';

export default function useScrollAnimation(options = {}) {
  const ref = useRef(null);
  const { threshold = 0.1, rootMargin = '0px', once = true } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-in');
          if (once) observer.disconnect();
        } else if (!once) {
          el.classList.remove('animate-in');
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}
