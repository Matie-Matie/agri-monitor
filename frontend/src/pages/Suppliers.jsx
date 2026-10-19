import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Spinner, EmptyState } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

export default function Suppliers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contact: '' });

  const load = () => {
    setLoading(true);
    api.get('/suppliers').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', contact: '' }); setModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, contact: s.contact || '' }); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post('/suppliers', form);
      toast.success(editing ? 'Supplier updated' : 'Supplier added');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const remove = async (s) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success('Supplier deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete'); }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-mid-500">Who delivers what. The same product can come from different suppliers.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add supplier</Button>
      </header>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">Supplier</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Products</th>
                <th className="px-4 py-3 text-center">Stock batches</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-mid-500">{s.contact || '—'}</td>
                  <td className="px-4 py-3 text-center">{s.product_count}</td>
                  <td className="px-4 py-3 text-center">{s.batch_count}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(s)} className="p-2 rounded-full hover:bg-status-danger/10 text-mid-500 hover:text-status-danger" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState title="No suppliers yet" subtitle="Add the first one." />}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit supplier' : 'Add supplier'}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Contact (phone / email)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Save changes' : 'Add supplier'}</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
