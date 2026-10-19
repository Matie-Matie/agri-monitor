import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Spinner, Badge, fmtDateTime } from '../components/ui.jsx';

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activity-logs', { params: { limit: 200 } }).then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, []);

  const tone = (action) => {
    if (action.includes('Sale')) return 'ok';
    if (action.includes('expired')) return 'danger';
    if (action.includes('Delete') || action.includes('Archive')) return 'danger';
    if (action.includes('Update') || action.includes('adjustment')) return 'warn';
    return 'neutral';
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="text-mid-500">Audit trail of all system actions.</p>
      </header>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-brand-100 max-h-[65vh] overflow-y-auto">
            {logs.map((l) => {
              let detail = '';
              try { const d = JSON.parse(l.details); detail = d?.batch ? `${d.batch} · ${d.qty ?? ''}` : d?.items ? `${d.items} items` : d?.name || ''; } catch {}
              return (
                <li key={l.id} className="px-6 py-3 flex items-center gap-4">
                  <Badge tone={tone(l.action)}>{l.action.split(' ')[0]}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.action} {detail && <span className="text-mid-500 font-normal">— {detail}</span>}</p>
                    <p className="text-xs text-mid-500">by {l.user_name || 'System'}</p>
                  </div>
                  <span className="text-xs text-mid-500 shrink-0">{fmtDateTime(l.created_at)}</span>
                </li>
              );
            })}
          </ul>
          {logs.length === 0 && <p className="text-center text-mid-500 py-10">No activity recorded.</p>}
        </Card>
      )}
    </div>
  );
}