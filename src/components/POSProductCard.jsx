import React from 'react';

export default function POSProductCard({ product, movement = 'sale', onSelect }) {
  const color = movement === 'sale' ? '#fff' : movement === 'gift' ? '#e6f3ff' : '#ffecec';
  const border = movement === 'sale' ? '#ddd' : movement === 'gift' ? '#1E90FF' : '#FF4D4F';

  return (
    <div onClick={() => onSelect && onSelect(product)} style={{ background: color, border: `2px solid ${border}`, borderRadius: 8, padding: 10, width: 140, cursor: 'pointer' }}>
      <div style={{ fontWeight: 700 }}>{product.name}</div>
      <div style={{ color: '#666' }}>{product.price} SAR</div>
    </div>
  );
}
