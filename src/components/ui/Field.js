import React from 'react';

/**
 * Shared labeled-input primitive matching the Apple-style design tokens.
 */
const Field = ({ label, id, as = 'input', className = '', children, ...props }) => {
  const inputClasses = [
    'w-full h-11 px-4 rounded-ctrl border border-hairline bg-surface text-fg text-body',
    'focus:outline-none focus:border-link focus:ring-4 focus:ring-[rgba(0,102,204,0.15)]',
    'transition-colors',
    className,
  ].join(' ');

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-small text-secondary mb-1.5">
          {label}
        </label>
      )}
      {as === 'select' ? (
        <select id={id} className={inputClasses} {...props}>
          {children}
        </select>
      ) : (
        <input id={id} className={inputClasses} {...props} />
      )}
    </div>
  );
};

export default Field;
