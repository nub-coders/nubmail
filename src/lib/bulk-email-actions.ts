export async function bulkPatchEmails(ids: string[], fields: Record<string, unknown>): Promise<{ success: number; failed: number }> {
  const res = await fetch('/api/emails', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ emailIds: ids, ...fields }),
  });
  if (!res.ok) return { success: 0, failed: ids.length };
  const data = await res.json();
  return { success: data.success ?? ids.length, failed: data.failed ?? 0 };
}

export async function bulkDeleteEmails(ids: string[]): Promise<{ success: number; failed: number }> {

  const results = await Promise.allSettled(
    ids.map(emailId =>
      fetch(`/api/emails?emailId=${emailId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then(res => { if (!res.ok) throw new Error(); })
    )
  );
  const success = results.filter(r => r.status === 'fulfilled').length;
  return { success, failed: results.length - success };
}

export async function bulkDeleteDrafts(ids: string[]): Promise<{ success: number; failed: number }> {

  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`/api/drafts?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then(res => { if (!res.ok) throw new Error(); })
    )
  );
  const success = results.filter(r => r.status === 'fulfilled').length;
  return { success, failed: results.length - success };
}
