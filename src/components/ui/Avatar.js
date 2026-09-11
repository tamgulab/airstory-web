import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';

/**
 * Default profile picture. No photo upload exists yet, so every avatar in
 * the app today is a placeholder. This is a clean vector redraw of the
 * reference icon (the original was a watermarked stock preview with
 * uneven padding, which showed through as a dark sliver and white gaps
 * once cropped into a circle) — it fills the circle edge-to-edge at any size.
 */
const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-22 h-22',
};

const Avatar = ({ size = 'md', className = '', style }) => (
  <img
    src={defaultAvatar}
    alt=""
    className={[
      'rounded-full object-cover shrink-0 bg-gray-100',
      SIZE_CLASSES[size] || SIZE_CLASSES.md,
      className,
    ].join(' ')}
    style={style}
  />
);

export default Avatar;
