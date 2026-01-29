function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase());
}

export function initWaitlistForm({ form, messageElement, emailInput }) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    messageElement.textContent = "";
    messageElement.classList.remove(
      "mk-waitlist-message--error",
      "mk-waitlist-message--success"
    );
    emailInput.classList.remove("mk-input--error");

    if (!isValidEmail(email)) {
      emailInput.classList.add("mk-input--error");
      messageElement.textContent = "Add a valid email to join the waitlist.";
      messageElement.classList.add("mk-waitlist-message--error");
      return;
    }

    // Placeholder: in production, wire this up to your waitlist backend or provider.
    // Keeping everything on the client for now to match the static-site constraint.
    form.reset();
    messageElement.textContent =
      "You’re on the list. We’ll reach out when MemoryKit is ready.";
    messageElement.classList.add("mk-waitlist-message--success");
  });
}

