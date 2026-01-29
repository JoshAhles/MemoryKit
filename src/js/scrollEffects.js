export function initScrollEffects() {
  const hero = document.querySelector(".mk-hero");
  const visual = document.querySelector(".mk-brain-visual");

  if (!hero || !(visual instanceof HTMLElement)) return;

  let rafId = null;
  const update = () => {
    const rect = hero.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - vh / 2);
    const normalized = Math.min(distance / (vh / 2), 1);
    const intensity = 1 - normalized;

    visual.style.transform = `scale(${1 + intensity * 0.03})`;
    visual.style.opacity = String(0.8 + intensity * 0.2);
    visual.classList.toggle("mk-brain-pulse", intensity > 0.4);
    rafId = null;
  };

  const onScroll = () => {
    if (rafId == null) rafId = requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
}
