// Accordion-header scroll stabilization — shared by QaReviewTab and
// McqReviewSection group headers.
//
// Bug (2026-07-15, reproduced on both review surfaces): with one video group
// expanded, clicking ANOTHER group's header collapses thousands of px of
// content above the clicked header. The browser's scroll anchor was a node
// inside that removed content, so anchoring gives up, scrollY stays frozen,
// and the clicked header shoots out of the viewport — the user lands mid-way
// through the newly expanded group's items ("jumps to the last question").
//
// Fix: measure the clicked header's viewport offset, apply the state change,
// then after React commits (rAF fires post-commit for discrete events,
// pre-paint) restore the offset with an instant scrollBy. The header stays
// exactly where the user clicked it; no jump in either direction.
export function withStableHeader(el: HTMLElement, mutate: () => void): void {
  const prevTop = el.getBoundingClientRect().top;
  mutate();
  requestAnimationFrame(() => {
    const delta = el.getBoundingClientRect().top - prevTop;
    if (delta !== 0) window.scrollBy(0, delta);
  });
}
