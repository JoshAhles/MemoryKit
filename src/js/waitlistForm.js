function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase().trim());
}

/**
 * Wires validation and UI feedback for the waitlist form.
 * Invalid: preventDefault + show error. Valid: show "Signing up…", hide form row/note, let Brevo handle submit.
 * @param {Object} opts
 * @param {HTMLFormElement} opts.form
 * @param {HTMLElement} opts.messageElement - e.g. mk-waitlist-confirm
 * @param {HTMLInputElement} opts.emailInput
 * @param {HTMLElement|null} [opts.formRow] - optional; hidden when showing "Signing up…"
 * @param {HTMLElement|null} [opts.noteElement] - optional; hidden when showing "Signing up…"
 */
export function initWaitlistForm({ form, messageElement, emailInput, formRow = null, noteElement = null }) {
  form.addEventListener("submit", (event) => {
    const email = emailInput.value.trim();
    messageElement.textContent = "";
    messageElement.classList.remove("mk-waitlist-message--error", "mk-waitlist-message--success");
    emailInput.classList.remove("mk-input--error");

    if (!isValidEmail(email)) {
      event.preventDefault();
      emailInput.classList.add("mk-input--error");
      messageElement.textContent = "Please enter a valid email address.";
      messageElement.classList.add("mk-waitlist-message--error");
      messageElement.style.display = "block";
      if (formRow) formRow.style.display = "";
      if (noteElement) noteElement.style.display = "";
      return;
    }

    messageElement.textContent = "Signing up…";
    messageElement.classList.add("mk-waitlist-message--success");
    messageElement.style.display = "block";
    if (formRow) formRow.style.display = "none";
    if (noteElement) noteElement.style.display = "none";
    // Do not preventDefault: Brevo's script handles submission; MutationObserver in index.html shows final success/error.
  });
}

