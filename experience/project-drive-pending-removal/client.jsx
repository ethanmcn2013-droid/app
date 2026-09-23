import { createRoot } from 'react-dom/client';
import { ConnectionsSection } from '@/components/app/settings/sections/connections';

const query = new URLSearchParams(location.search);
fetch('/states.json').then(response => response.json()).then(data => {
  const state = query.get('state') || 'current';
  window.__removal = { state, reads: [], states: data.states };
  window.__driveFlag = state === 'flag-off' ? 'false' : 'true';
  createRoot(document.getElementById('root')).render(<main style={{maxWidth:920,margin:'0 auto',padding:16}}>
    <p style={{fontSize:12,marginBottom:24}}>Synthetic local fixture. Actual Connections component; status comes from isolated SQLite. No Google or identity service is contacted.</p>
    <ConnectionsSection projectId="ws-a" canManage={state !== 'member'} />
  </main>);
});
