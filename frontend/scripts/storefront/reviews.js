// Customer Reviews & Feedback Management

async function loadItemReviews(itemId) {
  const container = document.getElementById("item-modal-reviews-list");
  const summaryEl = document.getElementById("item-modal-rating-summary");
  if (!container) return;

  container.innerHTML = `<div class="text-xs text-slate-400 py-3">Loading customer reviews...</div>`;

  const res = await apiFetch(`/api/items/${itemId}/reviews`);
  if (res.ok && res.data.success) {
    const data = res.data.data;
    const avg = data.averageRating || 5;
    const count = data.totalReviews || 0;

    if (summaryEl) {
      summaryEl.textContent = `Rating: ${avg} / 5 (${count} ${count === 1 ? "review" : "reviews"})`;
    }

    if (!data.reviews || data.reviews.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
          <p class="text-xs text-slate-500">No customer reviews yet. Be the first to share your experience!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.reviews.map((r) => {
      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";
      return `
        <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-slate-900">${escapeHtml(r.customerName)}</span>
              ${r.isVerifiedBuyer ? `<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Verified Buyer</span>` : ""}
            </div>
            <span class="text-slate-400 text-[10px]">${dateStr}</span>
          </div>
          <div class="flex items-center gap-1 text-amber-500 mb-1">
            ${Array.from({ length: r.rating || 5 }).map(() => `<i data-lucide="star" class="w-3 h-3 fill-amber-400 text-amber-400"></i>`).join("")}
          </div>
          ${r.comment ? `<p class="text-slate-600 leading-relaxed">${escapeHtml(r.comment)}</p>` : ""}
        </div>
      `;
    }).join("");
    renderIcons();
  }
}

function toggleReviewForm(show) {
  const form = document.getElementById("item-modal-review-form");
  if (!form) return;
  if (show === undefined) {
    form.classList.toggle("hidden");
  } else if (show) {
    form.classList.remove("hidden");
  } else {
    form.classList.add("hidden");
  }
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  if (!state.currentItemId) return;

  const btn = document.getElementById("btn-submit-review");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const customerName = document.getElementById("review-input-name").value.trim();
  const rating = parseInt(document.getElementById("review-input-rating").value, 10);
  const comment = document.getElementById("review-input-comment").value.trim();

  const res = await apiFetch(`/api/items/${state.currentItemId}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      customerName,
      rating,
      comment,
    }),
  });

  btn.disabled = false;
  btn.textContent = "Submit Review";

  if (res.ok && res.data.success) {
    showToast("Thank you! Your review has been published.");
    document.getElementById("review-input-comment").value = "";
    toggleReviewForm(false);
    await loadItemReviews(state.currentItemId);
  } else {
    showToast(res.data.error?.message || "Failed to submit review", "error");
  }
}
