const zipForm = document.querySelector("#zip-form");
const quoteForm = document.querySelector("#quote-form");
const formMessage = document.querySelector("#form-message");

zipForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const zip = new FormData(zipForm).get("zip");
  quoteForm.elements.zip.value = zip;
  document.querySelector("#quote").scrollIntoView({ behavior: "smooth" });
  document.querySelector("#zip-note").textContent = `Great — we'll check current availability near ${zip}.`;
});

document.querySelectorAll("[data-service]").forEach((link) => {
  link.addEventListener("click", () => {
    quoteForm.elements.service.value = link.dataset.service;
  });
});

quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = quoteForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Sending request…";
  formMessage.textContent = "";

  try {
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(quoteForm))),
    });
    const result = await response.json();
    formMessage.textContent = result.message;
    if (result.ok) quoteForm.reset();
  } catch {
    formMessage.textContent = "We couldn't submit the request. Please try again.";
  } finally {
    button.disabled = false;
    button.innerHTML = "Request my free estimate <span>→</span>";
  }
});
