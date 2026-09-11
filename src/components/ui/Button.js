import React from 'react';

/**
 * Shared button primitive matching the Apple-style design tokens
 * (pill radius, 44px/36px heights, restrained variants).
 */
const VARIANT_CLASSES = {
  primary: 'bg-primary text-on-primary',
  outline: 'border border-link text-link bg-transparent',
  neutral: 'border border-hairline text-fg bg-surface',
  danger: 'border border-hairline text-aqi-unhealthy bg-surface',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'default',
  wide = false,
  className = '',
  ...props
}) => {
  const sizeClasses =
    size === 'sm' ? 'h-9 px-4 text-small' : 'h-11 px-5 text-body';

  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-pill font-normal',
        'transition-opacity duration-150 hover:opacity-85 disabled:opacity-35 disabled:cursor-default',
        sizeClasses,
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
        wide ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
