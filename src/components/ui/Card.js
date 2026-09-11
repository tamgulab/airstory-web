import React from 'react';

/**
 * Shared surface/card primitive matching the Apple-style design tokens.
 */
const Card = ({ children, flat = false, className = '', ...props }) => (
  <div
    className={[
      'rounded-card border p-6',
      flat ? 'bg-canvas border-hairline' : 'bg-surface border-hairline-soft',
      className,
    ].join(' ')}
    {...props}
  >
    {children}
  </div>
);

export default Card;
