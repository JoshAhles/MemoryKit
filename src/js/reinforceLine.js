/**
 * Hero reinforce line: cycles through three phrases with a soft
 * crossfade + subtle blur reveal (no slide). One line that “settles into focus.”
 */
export function initReinforceLine() {
  const container = document.querySelector(".mk-hero-reinforce-inner");
  const phrases = document.querySelectorAll(".mk-hero-reinforce-phrase");
  if (!container || !phrases.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fadeDuration = 0.6;
  const overlap = 0.25;
  const holdDuration = 3.2;
  const blurAmount = prefersReducedMotion ? "0px" : "4px";
  let index = 0;

  function setVisible(i) {
    phrases.forEach((el, j) => {
      el.classList.toggle("is-visible", j === i);
    });
  }

  function animateTo(nextIndex) {
    const current = phrases[index];
    const next = phrases[nextIndex];

    current.classList.remove("is-visible");
    next.classList.add("is-visible");

    // Current: fade out (+ optional blur)
    gsap.to(current, {
      opacity: 0,
      filter: `blur(${blurAmount})`,
      duration: fadeDuration,
      ease: "power2.inOut",
    });

    // Next: fade in and sharpen (blur reveal when motion allowed)
    gsap.set(next, { opacity: 0, filter: `blur(${blurAmount})` });
    gsap.to(next, {
      opacity: 1,
      filter: "blur(0px)",
      duration: fadeDuration,
      delay: overlap,
      ease: "power2.inOut",
    });

    index = nextIndex;
  }

  setVisible(0);
  gsap.set(phrases[0], { opacity: 1, filter: "blur(0px)" });

  const interval = setInterval(() => {
    const nextIndex = (index + 1) % phrases.length;
    animateTo(nextIndex);
  }, (fadeDuration + holdDuration) * 1000);

  return () => clearInterval(interval);
}
