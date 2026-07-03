import { hasPermission, revokePermission } from '@/lib/permission';

async function renderPerms() {
  const result = await chrome.storage.local.get('chymusic:scrape-permissions');
  const records = (result['chymusic:scrape-permissions'] as { host: string; expiresAt: string }[]) ?? [];
  const container = document.getElementById('perms')!;
  if (records.length === 0) {
    container.innerHTML = '<p style="color:#9198a1;font-size:13px;">No permissions granted yet.</p>';
    return;
  }
  container.innerHTML = records
    .map(
      (r) => `
      <div class="perm-row">
        <div>
          <strong>${r.host}</strong><br/>
          <small style="color:#9198a1;">Expires ${new Date(r.expiresAt).toLocaleDateString()}</small>
        </div>
        <button data-host="${r.host}">Revoke</button>
      </div>
    `,
    )
    .join('');

  container.querySelectorAll('button[data-host]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const host = btn.getAttribute('data-host')!;
      await revokePermission(host);
      renderPerms();
    });
  });
}

renderPerms();
