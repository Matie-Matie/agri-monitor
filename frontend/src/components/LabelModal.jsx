import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal, Button, peso } from './ui.jsx';
import Barcode from './Barcode.jsx';

function Label({ p }) {
  return (
    <div className="print-label border border-black/70 rounded-sm p-[2mm] text-center bg-white text-black" style={{ width: '62mm' }}>
      <p className="font-bold tracking-wide" style={{ fontSize: '9pt' }}>MITCH AGRI SUPPLY</p>
      <p className="truncate" style={{ fontSize: '8pt' }}>{p.name}</p>
      <div className="flex justify-center my-1"><Barcode value={p.sku} height={34} /></div>
      <div className="flex justify-between items-baseline" style={{ fontSize: '8pt' }}>
        <span className="font-mono">{p.sku}</span>
        <span className="font-bold">{peso(p.selling_price)}</span>
      </div>
    </div>
  );
}

// products: [{ id, name, sku, selling_price }]. Prints Code128 labels, `copies` of each.
export default function LabelModal({ open, onClose, products }) {
  const [copies, setCopies] = useState(1);
  const n = Math.max(1, Math.min(100, Number(copies) || 1));
  const labels = products.flatMap((p) => Array.from({ length: n }, (_, i) => ({ p, key: `${p.id}-${i}` })));

  return (
    <>
      <Modal open={open} onClose={onClose} title="Barcode labels">
        <p className="text-sm text-mid-500 mb-4">
          Code128 from each product's SKU. The USB scanner reads these straight into the POS.
        </p>
        <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-1">
          {products.map((p) => <Label key={p.id} p={p} />)}
        </div>
        <div className="flex items-end gap-3">
          <label className="block w-32">
            <span className="block text-sm font-medium mb-1.5">Copies each</span>
            <input type="number" min="1" max="100" value={copies} onChange={(e) => setCopies(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full border border-brand-100 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
          </label>
          <Button className="flex-1" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print {labels.length} label{labels.length !== 1 && 's'}</Button>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </Modal>
      {open && createPortal(
        <div className="print-labels">{labels.map(({ p, key }) => <Label key={key} p={p} />)}</div>,
        document.body
      )}
    </>
  );
}
