// Runs before paint. Only the language choice is stored; no document data.
(() => {
  let saved;
  try { saved = localStorage.getItem('get-an-epub:language'); } catch {}
  const supported = value => typeof value === 'string' && (/^es(?:-|$)/i.test(value) ? 'es' : /^en(?:-|$)/i.test(value) ? 'en-US' : null);
  const detected = (navigator.languages?.length ? navigator.languages : [navigator.language]).map(supported).find(Boolean) || 'en-US';
  const locale = saved === 'en-US' || saved === 'es' ? saved : detected;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
})();
