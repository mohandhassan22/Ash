import React from 'react';

export function PriceBadge({ label = 'سعر خاص' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 6,
      background: 'gold',
      color: '#000',
      fontWeight: 600,
      fontSize: 12
    }}>
      {label}
    </span>
  );
}

export default PriceBadge;
