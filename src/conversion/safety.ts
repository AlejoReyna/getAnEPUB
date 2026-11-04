export const clean = (value: unknown, limit = 500) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffe\uffff\u202a-\u202e\u2066-\u2069]/g, '').slice(0, limit).normalize('NFC');
export const xml = (value: unknown) => clean(value, 5_000_000).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function safeLink(raw: string): string | undefined {
  if (/^p[1-9]\d*\.xhtml(?:#[a-z\d-]+)?$/i.test(raw)) return raw;
  try { const u = new URL(raw); return ['https:', 'http:', 'mailto:'].includes(u.protocol) && !u.username && !u.password ? clean(u.href, 2000) : undefined; } catch { return undefined; }
}
export const filename = (title: string) => (clean(title, 110).replace(/[<>:"/\\|?*]/g, '-').replace(/^\.+|\.+$/g,'') || 'mi-libro') + '.epub';
export function language(value: string) { return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value) ? value : 'und'; }
