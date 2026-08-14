'use client';

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';
  size?: 'sm' | 'md';
  dot?: boolean;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  style,
}: BadgeProps) {
  const dotColor = {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    neutral: '#64748b',
    gold: '#b88628',
  }[variant];

  const sizeStyle =
    size === 'sm'
      ? { fontSize: '0.6875rem', padding: '0.15rem 0.45rem' }
      : { fontSize: '0.75rem', padding: '0.2rem 0.6rem' };

  return (
    <span className={`badge badge-${variant}`} style={{ ...sizeStyle, ...style }}>
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
}
