import React, { useCallback, useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';

export interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.4,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prevToRef = useRef<number>(from);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals, 10) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number): string => {
      const hasDecimals = maxDecimals > 0;
      const options: Intl.NumberFormatOptions = {
        useGrouping: Boolean(separator),
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(Math.round(latest));
      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  // Handle initial display
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(prevToRef.current);
    }
  }, [formatValue]);

  // Trigger animation whenever `to` changes or component mounts
  useEffect(() => {
    if (isInView && startWhen) {
      onStart?.();

      const timeoutId = setTimeout(() => {
        motionValue.set(to);
        prevToRef.current = to;
      }, delay * 1000);

      const durationTimeoutId = setTimeout(() => {
        onEnd?.();
      }, delay * 1000 + duration * 1000);

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, to, delay, onStart, onEnd, duration]);

  // Update text content on spring tick
  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
};

export default CountUp;
