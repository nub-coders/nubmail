export async function bulkPatchEmails(
  ids: string[],
  fields: Record<string, unknown>
): Promise<{ success: number; failed: number }> {
  const token = localStorage.getItem('token');
  const results = await Promise.allSettled(
    ids.map(emailId =>
      fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emailId, ...fields }),
      }).then(res => { if (!res.ok) throw new Error(); })
    )
  );
  const success = results.filter(r => r.status === 'fulfilled').length;
  return { success, failed: results.length - success };
}

export async function bulkDeleteEmails(
  ids: string[]
): Promise<{ success: number; failed: number }> {
  const token = localStorage.getItem('token');
  const results = await Promise.allSettled(
    ids.map(emailId =>
      fetch(`/api/emails?emailId=${emailId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => { if (!res.ok) throw new Error(); })
    )
  );
  const success = results.filter(r => r.status === 'fulfilled').length;
  return { success, failed: results.length - success };
}

export async function bulkDeleteDrafts(
  ids: string[]
): Promise<{ success: number; failed: number }> {
  const token = localStorage.getItem('token');
  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`/api/drafts?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => { if (!res.ok) throw new Error(); })
    )
  );
  const success = results.filter(r => r.status === 'fulfilled').length;
  return { success, failed: results.length - success };
}
