import React, { useEffect, useState } from 'react';
import { listWasteLogs } from '../api/wasteLogs';

export default function DashboardWasteSummary() {
  const [summary, setSummary] = useState({ gifts: 0, waste: 0, lossValue: 0 });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await listWasteLogs();
    if (!data) return;
    const gifts = data.filter(d => d.type === 'gift').reduce((s, r) => s + parseFloat(r.qty || 0), 0);
    const waste = data.filter(d => d.type === 'waste').reduce((s, r) => s + parseFloat(r.qty || 0), 0);
    const lossValue = data.reduce((s, r) => s + parseFloat(r.cost || 0), 0);
    setSummary({ gifts, waste, lossValue });
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
        <div>إجمالي الهدايا هذا الشهر</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.gifts}</div>
      </div>
      <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
        <div>إجمالي الهوالك والخسائر</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.waste} ({summary.lossValue} SAR)</div>
      </div>
    </div>
  );
}
