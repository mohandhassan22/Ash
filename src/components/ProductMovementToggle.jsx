import React from 'react';

export default function ProductMovementToggle({ value = 'sale', onChange }) {
  const options = [
    { key: 'sale', label: 'بيع', color: '#000' },
    { key: 'gift', label: 'هدية', color: '#1E90FF' },
    { key: 'waste', label: 'هالك', color: '#FF4D4F' }
  ];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange && onChange(opt.key)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: value === opt.key ? `2px solid ${opt.color}` : '1px solid #ddd',
            background: value === opt.key ? opt.color + '22' : '#fff',
            color: opt.key === 'sale' ? '#000' : opt.color,
            cursor: 'pointer'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
