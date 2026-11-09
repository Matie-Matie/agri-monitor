import { createPortal } from 'react-dom';
import { fmtDateTime, peso } from './ui.jsx';

// Printable receipt / invoice. Hidden on screen, and the app is hidden on print
// (see index.css), so window.print() outputs only this sheet — same trick as the
// barcode labels. Works with the data from GET /sales/:id and from POST /sales.
export default function ReceiptPrint({ sale }) {
  if (!sale) return null;
  const paid = sale.payment_status === 'paid';
  return createPortal(
    <div className="print-receipt">
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: '13pt', letterSpacing: '0.5px' }}>MITCH AGRI SUPPLY</div>
        <div>Roxas, Isabela</div>
      </div>
      <div className="print-rule" />
      <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '1px', margin: '4px 0' }}>
        {paid ? 'RECEIPT' : 'INVOICE'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>No. {sale.invoice_no}</span>
        <span>{fmtDateTime(sale.created_at)}</span>
      </div>
      <div>Customer: {sale.customer_name || 'Walk-in'}</div>
      <div>Cashier: {sale.cashier || '—'}</div>
      <div className="print-rule" />
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Item</th>
            <th style={{ textAlign: 'center' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(sale.items || []).map((it, i) => (
            <tr key={it.id ?? i}>
              <td>{it.product_name || it.name}</td>
              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{it.quantity} {it.unit || ''}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{peso(it.unit_price)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{peso(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="print-rule" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '11pt' }}>
        <span>{paid ? 'TOTAL PAID' : 'BALANCE DUE'}</span>
        <span>{peso(sale.total_amount)}</span>
      </div>
      {paid && sale.paid_at && <div>Paid {fmtDateTime(sale.paid_at)}</div>}
      <div className="print-rule" />
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        {paid ? 'Thank you for your purchase!' : 'Please settle the balance. Thank you!'}
      </div>
      <div style={{ textAlign: 'center', fontSize: '8pt', marginTop: 4 }}>Agri Monitor · Mitch Agri Supply</div>
    </div>,
    document.body
  );
}
