(() => {
  "use strict";

  let candidateImageUrls = [];

  function setCopyrightFeedback(message, type = "error") {
    const el = document.getElementById("copyright-report-feedback");
    if (!el) return;
    if (!message) {
      el.textContent = "";
      el.className = "hidden rounded-xl border px-3.5 py-2.5 text-xs font-semibold";
      return;
    }
    el.textContent = message;
    el.className =
      type === "success"
        ? "rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-3.5 py-2.5 text-xs font-semibold"
        : "rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3.5 py-2.5 text-xs font-semibold";
  }

  function renderCandidateImagePicker(selectedUrl) {
    const wrap = document.getElementById("copyright-candidate-images-wrap");
    const listEl = document.getElementById("copyright-candidate-images");
    const urlInput = document.getElementById("copyright-image-url");
    if (!wrap || !listEl) return;

    const cleanCandidates = candidateImageUrls.filter(
      (u) => typeof u === "string" && u.trim() && !/^data:/i.test(u.trim())
    );

    if (cleanCandidates.length === 0) {
      wrap.classList.add("hidden");
      listEl.innerHTML = "";
      return;
    }

    wrap.classList.remove("hidden");
    listEl.innerHTML = cleanCandidates
      .map((src, idx) => {
        const active = src === selectedUrl || (!selectedUrl && idx === 0);
        return `
          <button type="button" data-candidate-idx="${idx}" onclick="selectCopyrightCandidateImage(${idx})" class="relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
          active ? "border-rose-600 ring-2 ring-rose-200" : "border-slate-200 opacity-80 hover:opacity-100"
        }" title="Select image ${idx + 1}">
            <img src="${escapeHtml(src)}" alt="Reported candidate ${idx + 1}" class="w-full h-full object-cover pointer-events-none" />
          </button>
        `;
      })
      .join("");

    if (urlInput && !urlInput.value.trim()) {
      urlInput.value = selectedUrl || cleanCandidates[0];
    }
  }

  window.selectCopyrightCandidateImage = function selectCopyrightCandidateImage(idx) {
    const cleanCandidates = candidateImageUrls.filter(
      (u) => typeof u === "string" && u.trim() && !/^data:/i.test(u.trim())
    );
    const chosen = cleanCandidates[Number(idx) || 0];
    if (!chosen) return;
    const urlInput = document.getElementById("copyright-image-url");
    if (urlInput) urlInput.value = chosen;
    renderCandidateImagePicker(chosen);
  };

  window.openCopyrightReportModal = function openCopyrightReportModal(prefill = {}) {
    const modal = document.getElementById("copyright-report-modal");
    if (!modal) return;

    setCopyrightFeedback("");
    const contextBanner = document.getElementById("copyright-report-context");
    const storeInput = document.getElementById("copyright-store-subdomain");
    const itemIdInput = document.getElementById("copyright-item-id");
    const itemTitleInput = document.getElementById("copyright-item-title");
    const pageUrlInput = document.getElementById("copyright-page-url");
    const targetTypeInput = document.getElementById("copyright-target-type");
    const imageUrlInput = document.getElementById("copyright-image-url");

    const images = Array.isArray(prefill.images)
      ? prefill.images.filter((u) => typeof u === "string" && u.trim() && !/^data:/i.test(u.trim()))
      : [];
    candidateImageUrls = images;

    const primaryImage =
      (typeof prefill.imageUrl === "string" && !/^data:/i.test(prefill.imageUrl.trim())
        ? prefill.imageUrl.trim()
        : "") ||
      images[0] ||
      "";

    const detectedSubdomain =
      prefill.storeSubdomain ||
      (typeof state !== "undefined" && state?.activeTenant?.subdomain) ||
      "";

    if (storeInput) storeInput.value = detectedSubdomain;
    if (itemIdInput) itemIdInput.value = prefill.itemId || "";
    if (itemTitleInput) itemTitleInput.value = prefill.itemTitle || "";
    if (pageUrlInput) pageUrlInput.value = prefill.pageUrl || window.location.href;
    if (targetTypeInput) targetTypeInput.value = prefill.targetType || "ITEM_IMAGE";
    if (imageUrlInput) imageUrlInput.value = primaryImage;

    if (contextBanner) {
      if (prefill.itemTitle || detectedSubdomain) {
        const parts = [
          prefill.itemTitle ? `Item: ${prefill.itemTitle}` : "",
          detectedSubdomain ? `Store: ${detectedSubdomain}.store254.co.ke` : "",
        ].filter(Boolean);
        contextBanner.textContent = parts.join(" · ");
        contextBanner.classList.remove("hidden");
      } else {
        contextBanner.textContent = "";
        contextBanner.classList.add("hidden");
      }
    }

    renderCandidateImagePicker(primaryImage);
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    if (typeof window.renderIcons === "function") window.renderIcons();
  };

  window.closeCopyrightReportModal = function closeCopyrightReportModal() {
    const modal = document.getElementById("copyright-report-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  };

  window.reportCurrentStorefrontItem = function reportCurrentStorefrontItem() {
    const itemId = typeof state !== "undefined" ? state?.currentItemId : null;
    const itemsList = typeof state !== "undefined" && Array.isArray(state?.items) ? state.items : [];
    const item = itemsList.find((it) => it.id === itemId);
    const currentImages =
      typeof state !== "undefined" && Array.isArray(state?.currentItemImages)
        ? state.currentItemImages
        : Array.isArray(item?.images)
        ? item.images
        : [];
    const activeIdx =
      typeof state !== "undefined" && Number.isInteger(state?.currentItemImageIndex)
        ? state.currentItemImageIndex
        : 0;

    window.openCopyrightReportModal({
      itemId: item?.id || itemId || "",
      itemTitle: item?.title || document.getElementById("item-modal-title")?.textContent || "",
      storeSubdomain: typeof state !== "undefined" ? state?.activeTenant?.subdomain || "" : "",
      images: currentImages,
      imageUrl: currentImages[activeIdx] || currentImages[0] || "",
      pageUrl: window.location.href,
      targetType: "ITEM_IMAGE",
    });
  };

  window.handleCopyrightReportSubmit = async function handleCopyrightReportSubmit(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    setCopyrightFeedback("");

    const reporterNameEl = document.getElementById("copyright-reporter-name");
    const reporterEmailEl = document.getElementById("copyright-reporter-email");
    const imageUrlEl = document.getElementById("copyright-image-url");
    const originalWorkEl = document.getElementById("copyright-original-url");
    const reasonEl = document.getElementById("copyright-reason");
    const confirmEl = document.getElementById("copyright-good-faith");
    const submitBtn = document.getElementById("btn-submit-copyright-report");

    const reporterName = (reporterNameEl?.value || "").trim();
    const reporterEmail = (reporterEmailEl?.value || "").trim();
    const reportedImageUrl = (imageUrlEl?.value || "").trim();
    const originalWorkUrl = (originalWorkEl?.value || "").trim();
    const reason = (reasonEl?.value || "").trim();
    const goodFaithConfirmed = Boolean(confirmEl?.checked);

    if (reporterName.length < 2) {
      return setCopyrightFeedback("Please enter your full name.", "error");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      return setCopyrightFeedback("Please enter a valid email address.", "error");
    }
    if (reportedImageUrl.length < 3) {
      return setCopyrightFeedback("Please provide the URL of the copyrighted image being reported.", "error");
    }
    if (reason.length < 10) {
      return setCopyrightFeedback("Please describe the copyright ownership and infringement (at least 10 characters).", "error");
    }
    if (!goodFaithConfirmed) {
      return setCopyrightFeedback("Please check the good-faith ownership/authorization declaration.", "error");
    }

    const payload = {
      reporterName,
      reporterEmail,
      reportedImageUrl,
      targetType: document.getElementById("copyright-target-type")?.value || "ITEM_IMAGE",
      pageUrl: document.getElementById("copyright-page-url")?.value || window.location.href,
      storeSubdomain: (document.getElementById("copyright-store-subdomain")?.value || "").trim() || undefined,
      itemId: (document.getElementById("copyright-item-id")?.value || "").trim() || undefined,
      itemTitle: (document.getElementById("copyright-item-title")?.value || "").trim() || undefined,
      originalWorkUrl: originalWorkUrl || undefined,
      reason,
      goodFaithConfirmed: true,
    };

    const origText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting report...";
    }

    try {
      const res = await apiFetch("/api/platform/copyright-reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data?.success) {
        const msg =
          res.data.message ||
          "Report submitted. Store254 Super Admin will review and remove confirmed copyrighted images.";
        setCopyrightFeedback(msg, "success");
        if (typeof showToast === "function") showToast(msg, "success");
        document.getElementById("copyright-report-form")?.reset();
        setTimeout(() => {
          window.closeCopyrightReportModal();
        }, 1600);
      } else {
        const err = res.data?.error?.message || "Could not submit copyright report. Please check your details.";
        setCopyrightFeedback(err, "error");
      }
    } catch {
      setCopyrightFeedback("Network error submitting report. Please try again.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText || "Submit Copyright Takedown Report";
      }
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("report") === "copyright" || window.location.hash === "#report-copyright") {
      window.openCopyrightReportModal();
    }
  });
})();
