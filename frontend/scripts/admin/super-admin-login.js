const apiBase =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".localhost")
    ? "http://localhost:8787"
    : window.location.origin;

const form = document.getElementById("admin-login-form");
const submit = document.getElementById("admin-login-submit");
const errorBox = document.getElementById("login-error");

function showLoginError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("visible");
}

function openPlatformAdmin() {
  window.location.replace("./super-admin.html");
}

async function checkExistingSession() {
  try {
    const response = await fetch(`${apiBase}/api/platform/admin/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (response.ok && data.success && data.authenticated) openPlatformAdmin();
  } catch {
    // The form remains usable if the session check cannot reach the API.
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.remove("visible");
  submit.disabled = true;
  submit.textContent = "Checking your details…";

  const formData = new FormData(form);
  try {
    const response = await fetch(`${apiBase}/api/platform/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || ""),
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showLoginError(data.error?.message || "Sign in failed. Check your username and password.");
      return;
    }
    openPlatformAdmin();
  } catch {
    showLoginError("Could not connect securely. Please check your connection and try again.");
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Sign in securely <span aria-hidden="true">→</span>';
  }
});

void checkExistingSession();
