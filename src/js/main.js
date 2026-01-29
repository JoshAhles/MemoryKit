import { initBrainScene } from "./brainScene.js";
import { initWaitlistForm } from "./waitlistForm.js";
import { initScrollEffects } from "./scrollEffects.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("mk-brain-canvas");
  if (canvas instanceof HTMLCanvasElement) {
    requestAnimationFrame(() => initBrainScene(canvas));
  }

  const form = document.getElementById("mk-waitlist-form");
  const message = document.getElementById("mk-waitlist-message");
  const emailInput = document.getElementById("mk-email");

  if (form instanceof HTMLFormElement && message && emailInput instanceof HTMLInputElement) {
    initWaitlistForm({ form, messageElement: message, emailInput });
  }

  initScrollEffects();
});

