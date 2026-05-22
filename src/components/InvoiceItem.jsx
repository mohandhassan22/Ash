import React from 'react';
import ProductMovementToggle from './ProductMovementToggle';
import PriceBadge from './PriceBadge';

export default function InvoiceItem({ item, onChangeMovement }) {
  const { product, qty, movement_type, special_price } = item;

  const badge = movement_type === 'gift' ? 'هدية' : movement_type === 'waste' ? 'هالك' : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderBottom: '1px solid #eee' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>{product?.name}</div>
          {badge && (
            <div style={{ padding: '2px 6px', borderRadius: 6, background: movement_type === 'gift' ? '#1E90FF' : '#FF4D4F', color: '#fff', fontSize: 12 }}>{badge}</div>
          )}
          {special_price && <PriceBadge />}
        </div>
        <div style={{ color: '#666' }}>{qty} x {product?.unit || product?.sku}</div>
      </div>

      <div>
        <ProductMovementToggle value={movement_type || 'sale'} onChange={(val) => onChangeMovement && onChangeMovement(val)} />
      </div>

    </div>
  );
}
