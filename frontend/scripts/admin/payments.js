// PAYMENT SETTINGS
  // ═══════════════════════════════════════
  async function loadPaymentSettings() {
    const r = await apiFetch('/payments/settings');
    if (!r.ok || !r.data?.data) return;
    const s = r.data.data;
    document.getElementById('payment-enabled').checked = Boolean(s.isEnabled);
    document.getElementById('payment-shortcode-type').value = s.shortcodeType || 'PAYBILL';
    document.getElementById('payment-shortcode').value = s.shortcode || s.mpesaShortcode || '';
  }

  async function savePaymentSettings(e) {
    e.preventDefault();
    const body = {
      isEnabled: document.getElementById('payment-enabled').checked,
      shortcodeType: document.getElementById('payment-shortcode-type').value,
      shortcode: document.getElementById('payment-shortcode').value.trim() || undefined,
      consumerKey: document.getElementById('payment-consumer-key').value.trim() || undefined,
      consumerSecret: document.getElementById('payment-consumer-secret').value.trim() || undefined,
      passkey: document.getElementById('payment-passkey').value.trim() || undefined,
    };
    const r = await apiFetch('/payments/settings', { method: 'PUT', body: JSON.stringify(body) });
    if (r.ok) showToast('Payment settings saved!');
    else showToast(apiErrorMessage(r, 'Failed to save.'), false);
  }

  // ═══════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════
  function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function inlineJs(value) {
    return JSON.stringify(String(value ?? '')).replace(/[<>&"]/g, ch => ({ '<':'\\u003c', '>':'\\u003e', '&':'\\u0026', '"':'&quot;' })[ch]);
  }

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  window.addEventListener('DOMContentLoaded', async () => {
    // Set store name on login screen from hostname
    if (tenantSlug) {
      document.getElementById('login-store-name').textContent = `Sign in to manage ${tenantSlug}.store254.co.ke`;
    }

    const r = await apiFetch('/auth/me');
    if (r.ok) {
      const user = r.data?.data;
      if (['OWNER', 'ADMIN'].includes(user?.role)) {
        hasSession = true;
        bootApp(user);
      } else {
        handleLogout('This account does not have store admin access.');
      }
    }

    lucide.createIcons();
  });
