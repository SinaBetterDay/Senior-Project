export function syncErrorMessage(errors) {
  if (Array.isArray(errors)) return errors.map(syncErrorMessage).filter(Boolean).join('; ').slice(0, 500) || null;
  const value = typeof errors === 'string' ? errors : errors?.message ?? errors?.error;
  if (typeof value !== 'string' || !value.trim()) return null;
  const message = value.split(/\r?\n/)[0];
  if (/<[^>]+>|node_modules|PrismaClient|\bat\s+\S+\s*\(/i.test(message)) return 'The sync failed. Check the server logs for technical details.';
  return message.slice(0, 500);
}