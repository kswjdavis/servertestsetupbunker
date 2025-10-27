import React, { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component that provides smooth page transition animations
 * Uses CSS animations for better performance (no additional dependencies)
 */
export default function PageTransition({
  children,
  className = ''
}: PageTransitionProps) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}

/**
 * Alternative component for slide transitions
 */
export function SlideTransition({
  children,
  className = '',
  direction = 'left'
}: PageTransitionProps & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const animationClass = {
    left: 'animate-slide-in-left',
    right: 'animate-slide-in-right',
    up: 'animate-slide-in-up',
    down: 'animate-slide-in-down'
  }[direction];

  return (
    <div className={`${animationClass} ${className}`}>
      {children}
    </div>
  );
}