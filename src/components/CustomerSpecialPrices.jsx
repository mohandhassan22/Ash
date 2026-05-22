import React, { useEffect, useState } from 'react';
import { listCustomerSpecialPrices, addSpecialPrice, updateSpecialPrice, deleteSpecialPrice } from '../api/specialPrices';

export default function CustomerSpecialPrices({ customerId }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!customerId) return;
    load();
  }, [customerId]);

  async function load() {
    const { data, error } = await listCustomerSpecialPrices(customerId);
    if (!error) setRows(data || []);
  }

  async function handleAdd() {
    const product_id = parseInt(prompt('Product ID') || '0', 10);
    const special_price = parseFloat(prompt('Special price') || '0');
    if (!product_id) return;
    await addSpecialPrice({ customer_id: customerId, product_id, special_price });
    load();
  }

  return (
    <div>
      <h3>الأسعار الخاصة</h3>
      <button onClick={handleAdd}>أضف سعر خاص</button>
      <table style={{ width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>السعر الخاص</th>
            <th>الحد الأدنى</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.product_id}</td>
              <td>{r.special_price}</td>
              <td>{r.min_qty}</td>
              <td>
                <button onClick={() => { const p = parseFloat(prompt('New price', r.special_price) || r.special_price); updateSpecialPrice(r.id, { special_price: p }).then(load); }}>تعديل</button>
                <button onClick={() => { if (confirm('حذف؟')) deleteSpecialPrice(r.id).then(load); }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
