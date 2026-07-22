let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (!region) {
    region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  return region;
}

/** Create the live region up front so assistive tech registers it before the first event. */
export function initAnnouncer(): void {
  ensureRegion();
}

/** Announce a message to screen readers without any visual change. */
export function announce(message: string): void {
  const node = ensureRegion();
  // Clear first so repeating the same text is re-announced.
  node.textContent = "";
  window.setTimeout(() => {
    node.textContent = message;
  }, 30);
}
