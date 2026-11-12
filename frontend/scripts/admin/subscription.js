let storeSubscriptionState = null;
let subscriptionPaymentBusy = false;

function subscriptionDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function setSubscriptionFeedback(message = '', tone = '') {
  const feedback = document.getElementById('subscription-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle('is-error', tone === 'error');
  feedback.classList.toggle('is-success', tone === 'success');
}

function updateSubscriptionCard(data) {
  const card = document.getElementById('subscription-card');
  if (!card || !data) return;
  storeSubscriptionState = data;
  card.classList.remove('hidden');

  const suspended = data.storeStatus === 'SUSPENDED';
  const pendingApproval = data.storeStatus === 'PENDING';
  const amount = Number(data.amount) || 0;
  const dueDate = subscriptionDate(data.subscriptionDueAt);
  const isDue = !dueDate || new Date(data.subscriptionDueAt).getTime() <= Date.now();
  const latest = data.latestPayment;
  const pendingPayment = latest?.status === 'INITIATED' &&
    Date.now() - new Date(latest.createdAt).getTime() < 5 * 60 * 1000;
  const configured = amount > 0 && Number(data.intervalDays) > 0;
  const canPay = configured && data.darajaConfigured && !pendingApproval && !pendingPayment;

  const badge = document.getElementById('subscription-status-badge');
  const title = document.getElementById('subscription-card-title');
  const message = document.getElementById('subscription-card-message');
  if (suspended) {
    badge.textContent = 'Store paused';
    title.textContent = 'Reactivate your store';
    message.textContent = 'Pay your subscription by M-Pesa. Your payment will be verified automatically and your storefront restored.';
  } else if (pendingApproval) {
    badge.textContent = 'Awaiting approval';
    title.textContent = 'Store subscription';
    message.textContent = 'Subscription payment becomes available after your store is approved.';
  } else if (pendingPayment) {
    badge.textContent = 'Payment pending';
    title.textContent = 'Approve the M-Pesa prompt';
    message.textContent = 'Check your phone and enter your M-Pesa PIN. We will verify the payment automatically.';
  } else if (isDue) {
    badge.textContent = 'Payment due';
    title.textContent = 'Keep your store active';
    message.textContent = 'Pay your subscription by M-Pesa. We will verify the payment and update your subscription automatically.';
  } else {
    badge.textContent = 'Subscription active';
    title.textContent = 'Your store is covered';
    message.textContent = 'Your subscription is active. You can renew early at any time.';
  }
  badge.classList.toggle('is-due', isDue && !suspended && !pendingApproval);
  badge.classList.toggle('is-suspended', suspended);

  document.getElementById('subscription-amount').textContent = configured ? fmt(amount) : 'Not configured';
  document.getElementById('subscription-period').textContent = configured ? `${data.intervalDays} days` : '—';
  document.getElementById('subscription-due-date').textContent = dueDate || 'Payment required';
  const phoneInput = document.getElementById('subscription-phone');
  if (phoneInput && !phoneInput.value && data.ownerPhone) phoneInput.value = data.ownerPhone;

  const payButton = document.getElementById('subscription-pay-button');
  payButton.disabled = !canPay || subscriptionPaymentBusy;
  payButton.textContent = suspended ? 'Pay and reactivate' : pendingPayment ? 'Prompt sent' : 'Pay subscription';
  const checkButton = document.getElementById('subscription-check-button');
  checkButton.classList.toggle('hidden', !pendingPayment);
  checkButton.disabled = subscriptionPaymentBusy;

  if (!configured) setSubscriptionFeedback('Subscription billing has not been configured yet. Please contact Store254 support.');
  else if (!data.darajaConfigured) setSubscriptionFeedback('M-Pesa payments are temporarily unavailable. Please contact Store254 support.');
  else if (pendingApproval) setSubscriptionFeedback('Your store must be approved before you can pay.');
  else if (pendingPayment && !subscriptionPaymentBusy) setSubscriptionFeedback(`A prompt was sent to ${latest.phoneNumber}.`);
  else if (!pendingPayment && latest?.status === 'FAILED') setSubscriptionFeedback(latest.resultDesc || 'The last payment did not go through. You can try again.', 'error');
}

function restrictSuspendedAdmin(isSuspended) {
  document.body.classList.toggle('store-subscription-restricted', isSuspended);
  document.getElementById('dashboard-metrics')?.classList.toggle('hidden', isSuspended);
  document.getElementById('dashboard-recent-orders-panel')?.classList.toggle('hidden', isSuspended);
  document.getElementById('header-add-product')?.classList.toggle('hidden', isSuspended);
  document.querySelectorAll('.admin-sidebar .sidebar-link, .admin-mobile-nav button').forEach((link) => {
    const isDashboard = link.id === 'nav-dashboard' || link.id === 'mobile-nav-dashboard';
    link.hidden = isSuspended && !isDashboard;
  });
}

async function loadStoreSubscription() {
  const result = await apiFetch('/billing/subscription');
  if (!result.ok || !result.data?.success) return null;
  updateSubscriptionCard(result.data.data);
  const suspended = result.data.data?.storeStatus === 'SUSPENDED';
  restrictSuspendedAdmin(suspended);
  return result.data.data;
}

async function refreshSubscriptionPayment(paymentId, { silent = false } = {}) {
  if (!paymentId) return null;
  const result = await apiFetch(`/billing/subscription/payments/${encodeURIComponent(paymentId)}`);
  if (!result.ok || !result.data?.success) {
    if (!silent) setSubscriptionFeedback(apiErrorMessage(result, 'Could not check the payment yet.'), 'error');
    return null;
  }
  const payment = result.data.data;
  if (payment.status === 'COMPLETED') {
    subscriptionPaymentBusy = false;
    setSubscriptionFeedback(`Payment received${payment.receipt ? ` · M-Pesa receipt ${payment.receipt}` : ''}. Updating your subscription…`, 'success');
    const wasSuspended = storeSubscriptionState?.storeStatus === 'SUSPENDED';
    const updated = await loadStoreSubscription();
    if (wasSuspended && updated?.storeStatus === 'ACTIVE') {
      setSubscriptionFeedback('Payment verified. Your store is active again.', 'success');
      window.setTimeout(() => window.location.reload(), 1800);
    } else {
      setSubscriptionFeedback(`Payment received${payment.receipt ? ` · M-Pesa receipt ${payment.receipt}` : ''}. Paid until ${subscriptionDate(updated?.subscriptionDueAt) || 'your new due date'}.`, 'success');
    }
    return payment;
  }
  if (payment.status === 'FAILED') {
    subscriptionPaymentBusy = false;
    updateSubscriptionCard({ ...storeSubscriptionState, latestPayment: payment });
    setSubscriptionFeedback(payment.resultDesc || 'Payment was not completed. You can try again.', 'error');
    return payment;
  }
  if (!silent) setSubscriptionFeedback('Payment is still pending. Approve the M-Pesa prompt on your phone.');
  return payment;
}

async function pollSubscriptionPayment(paymentId) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2500));
    const payment = await refreshSubscriptionPayment(paymentId, { silent: true });
    if (payment?.status === 'COMPLETED' || payment?.status === 'FAILED') {
      subscriptionPaymentBusy = false;
      updateSubscriptionCard(storeSubscriptionState);
      return;
    }
  }
  subscriptionPaymentBusy = false;
  updateSubscriptionCard(storeSubscriptionState);
  setSubscriptionFeedback('We are still waiting for Safaricom to confirm. You can check again shortly.');
}

async function startSubscriptionPayment() {
  if (subscriptionPaymentBusy) return;
  const phoneNumber = document.getElementById('subscription-phone').value.trim();
  subscriptionPaymentBusy = true;
  setSubscriptionFeedback('Sending M-Pesa prompt…');
  updateSubscriptionCard(storeSubscriptionState);
  const result = await apiFetch('/billing/subscription/payment-prompt', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: phoneNumber || undefined }),
  });
  if (!result.ok || !result.data?.success) {
    subscriptionPaymentBusy = false;
    updateSubscriptionCard(storeSubscriptionState);
    setSubscriptionFeedback(apiErrorMessage(result, 'Could not send the M-Pesa prompt.'), 'error');
    return;
  }
  const paymentId = result.data.data.paymentId;
  const latestPayment = {
    id: paymentId,
    status: 'INITIATED',
    amount: result.data.data.amount,
    phoneNumber: result.data.data.phoneNumber,
    createdAt: new Date().toISOString(),
  };
  storeSubscriptionState = { ...storeSubscriptionState, latestPayment };
  setSubscriptionFeedback(`${result.data.message} Approve it on your phone to continue.`);
  updateSubscriptionCard(storeSubscriptionState);
  void pollSubscriptionPayment(paymentId);
}

async function checkSubscriptionPayment() {
  if (subscriptionPaymentBusy) return;
  const paymentId = storeSubscriptionState?.latestPayment?.id;
  if (!paymentId) return;
  subscriptionPaymentBusy = true;
  updateSubscriptionCard(storeSubscriptionState);
  setSubscriptionFeedback('Checking with Safaricom…');
  const payment = await refreshSubscriptionPayment(paymentId);
  subscriptionPaymentBusy = false;
  updateSubscriptionCard(storeSubscriptionState);
}

document.getElementById('subscription-pay-button')?.addEventListener('click', () => void startSubscriptionPayment());
document.getElementById('subscription-check-button')?.addEventListener('click', () => void checkSubscriptionPayment());
