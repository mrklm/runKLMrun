/** Présentation observable, pas une preuve de lecture : titre et durée visibles,
 * onglet au premier plan, sans recouvrement (y compris le splash).
 * Aucun accès au stockage ici. */
export function isSuggestionVisible(card: HTMLElement): boolean {
  if (!card.isConnected || document.visibilityState !== 'visible') return false;
  const title = card.querySelector('h4'), summary = title?.nextElementSibling;
  if (!title || !summary) return false;
  for (const element of [title, summary]) {
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.left < 0 || rect.bottom > innerHeight || rect.right > innerWidth) return false;
    for (const fraction of [0.1, 0.5, 0.9]) {
      const hit = document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2);
      if (!hit || !element.contains(hit)) return false;
    }
  }
  return true;
}

/** Deux frames de confirmation après intersection. Le cleanup annule tout travail
 * avant présentation, notamment le premier montage exploratoire de StrictMode. */
export function watchSuggestionPresentation(card: HTMLElement, present: (stillVisible: () => boolean) => void): () => void {
  let disposed = false, delivered = false, intersecting = false;
  let frame: number | undefined, retry: ReturnType<typeof setTimeout> | undefined;
  const visible = () => !disposed && isSuggestionVisible(card);
  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (retry !== undefined) clearTimeout(retry);
    frame = undefined; retry = undefined;
  };
  const schedule = () => {
    cancel();
    if (disposed || delivered || !intersecting || document.visibilityState !== 'visible') return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (!visible()) { retry = setTimeout(schedule, 250); return; }
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (!visible()) { schedule(); return; }
        delivered = true;
        present(visible);
      });
    });
  };
  // Sans observation de visibilité disponible, ne pas présumer une présentation.
  if (typeof IntersectionObserver === 'undefined') return () => { disposed = true; };
  const observer = new IntersectionObserver(entries => {
    intersecting = entries.some(entry => entry.target === card && entry.isIntersecting);
    schedule();
  });
  observer.observe(card);
  document.addEventListener('visibilitychange', schedule);
  return () => {
    disposed = true; cancel(); observer.disconnect();
    document.removeEventListener('visibilitychange', schedule);
  };
}
