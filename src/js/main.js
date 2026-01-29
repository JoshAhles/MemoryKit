import { initBrainScene } from "./brainScene.js";
import { initWaitlistForm } from "./waitlistForm.js";
import { initScrollEffects } from "./scrollEffects.js";

const DEBUG = /[?&]debug=1/.test(location.search);
window.__pageLoadTime = performance.now();

window.addEventListener("DOMContentLoaded", () => {
  if (DEBUG) console.log("[main] DOMContentLoaded at", (performance.now() - window.__pageLoadTime).toFixed(0) + "ms");

  const canvas = document.getElementById("mk-brain-canvas");
  if (canvas instanceof HTMLCanvasElement) {
    requestAnimationFrame(() => initBrainScene(canvas));
  }

  // Waitlist: form and message elements (IDs match index.html / Brevo markup)
  const form = document.getElementById("sib-form");
  const messageElement = document.getElementById("mk-waitlist-confirm");
  const emailInput = document.getElementById("EMAIL");
  const formRow = form?.querySelector(".mk-waitlist-row") ?? null;
  const noteElement = document.getElementById("mk-waitlist-note");

  if (form instanceof HTMLFormElement && messageElement && emailInput instanceof HTMLInputElement) {
    initWaitlistForm({ form, messageElement, emailInput, formRow, noteElement });
  }

  initScrollEffects();
});
