// Read-only approximation of BaseItem.itemsThatNeedSync for ordinary synthetic notes.
// Missing row means never synced; disabled rows are deliberately excluded.
export function needsUpload(note, rows) {
  const row = rows.find(r => r.item_id === note.id);
  if (!row) return true;
  return !row.sync_disabled && (note.updated_time > row.sync_time || row.force_sync === 1);
}
