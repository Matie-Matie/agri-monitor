import { useEffect, useState } from 'react';
import { Plus, Pencil, ShieldCheck, Trash2 } from 'lucide-react';import api from '../api/client.js';
import { Card, Button, Input, Modal, Badge, Spinner } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

const emptyForm = { name: '', username: '', password: '', role: 'staff' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/users/${editing.id}`, { name: form.name, role: form.role, is_active: 1, password: form.password || undefined });
      toast.success('User updated');
    } else {
      await api.post('/users', form);
      toast.success('User created');
    }
    setModal(false);
    setForm(emptyForm);
    setEditing(null);
    load();
  };

  const toggleActive = async (u) => {
    if (!confirm(`${u.is_active ? 'Deactivate' : 'Activate'} "${u.name}"?`)) return;
    await api.put(`/users/${u.id}`, { name: u.name, role: u.role, is_active: u.is_active ? 0 : 1 });
    toast.success(u.is_active ? 'User deactivated' : 'User activated');
    load();
  };

  const remove = async (u) => {
    if (!confirm(`Delete "${u.name}"?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success('User deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-mid-500">Manage staff and access levels.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}><Plus className="w-4 h-4" /> Add user</Button>
      </header>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-mid-500">{u.username}</td>
                  <td className="px-4 py-3">
                    {u.role === 'admin'
                      ? <Badge tone="ok"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</Badge>
                      : <Badge tone="neutral">Staff</Badge>}
                  </td>
                  <td className="px-4 py-3">{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(u); setForm({ name: u.name, username: u.username, password: '', role: u.role }); setModal(true); }}
                        className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => toggleActive(u)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500">{u.is_active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => remove(u)} className="p-2 rounded-full hover:bg-status-danger/10 text-mid-500 hover:text-status-danger"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit user' : 'Add user'}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} required />
          <Input label={editing ? 'New password (leave blank to keep)' : 'Password'} type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
              <option value="staff">Staff (cashier)</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Save</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}