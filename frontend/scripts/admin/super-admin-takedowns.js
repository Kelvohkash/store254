// SUPER ADMIN COPYRIGHT TAKEDOWN CONTROLLER
// ════════════════════════════════════════════

(() => {
  let cachedReports = [];
  let activeReportStatus = "OPEN";
  let listenersBound = false;

  function resolvePreviewImageUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed || trimmed.startsWith("//")) return "";
    if (/^\/api\/media\/[^\s'"\\()\r\n]+$/i.test(trimmed)) {
      return `${superAdminApiBase}${trimmed}`;
    }
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function isExternalPreviewUrl(previewSrc) {
    if (!previewSrc) return false;
    try {
      return new URL(previewSrc, window.location.origin).origin !== window.location.origin;
    } catch {
      return true;
    }
  }

  function updateReportCounts(counts = {}) {
    const openCount = Number(counts.open || 0);
    const takenDownCount = Number(counts.takenDown || 0);
    const dismissedCount = Number(counts.dismissed || 0);
    const allCount = Number(counts.all || 0);

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setEl("sidebar-copyright-count", openCount);
    setEl("report-count-open", openCount);
    setEl("report-count-taken-down", takenDownCount);
    setEl("report-count-dismissed", dismissedCount);
    setEl("report-count-all", allCount);
  }

  function renderCopyrightReportsList() {
    const container = document.getElementById("copyright-reports-list");
    const countLabel = document.getElementById("copyright-result-count");
    if (!container) return;

    const filtered =
      activeReportStatus === "ALL"
        ? cachedReports
        : cachedReports.filter((r) => r.status === activeReportStatus);

    if (countLabel) {
      countLabel.textContent = `${filtered.length} report${filtered.length === 1 ? "" : "s"} shown`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div class="takedown-empty">No ${activeReportStatus === "ALL" ? "" : `${activeReportStatus.toLowerCase().replace(/_/g, " ")} `}copyright reports right now.</div>`;
      return;
    }

    container.innerHTML = filtered
      .map((rep) => {
        const previewSrc = resolvePreviewImageUrl(rep.reportedImageUrl);
        const storeLabel = rep.storeName
          ? `${rep.storeName}${rep.storeSubdomain ? ` (${rep.storeSubdomain}.store254.co.ke)` : ""}`
          : rep.storeSubdomain
          ? `${rep.storeSubdomain}.store254.co.ke`
          : "Unlinked / External URL";

        const statusBadgeClass =
          rep.status === "TAKEN_DOWN"
            ? "is-taken-down"
            : rep.status === "DISMISSED"
            ? "is-dismissed"
            : "is-open";
        const statusText =
          rep.status === "TAKEN_DOWN"
            ? "Taken Down"
            : rep.status === "DISMISSED"
            ? "Dismissed"
            : "Open Review";

        const proofLink =
          rep.originalWorkUrl && /^https?:\/\//i.test(rep.originalWorkUrl)
            ? `<a href="${escapeHtml(rep.originalWorkUrl)}" target="_blank" rel="noopener noreferrer" class="takedown-proof-link">View proof link ↗</a>`
            : rep.originalWorkUrl
            ? `<span class="takedown-meta-val">${escapeHtml(rep.originalWorkUrl)}</span>`
            : "";

        const pageLink =
          rep.pageUrl && /^https?:\/\//i.test(rep.pageUrl)
            ? `<a href="${escapeHtml(rep.pageUrl)}" target="_blank" rel="noopener noreferrer" class="takedown-proof-link">View page ↗</a>`
            : "";

        const actionsHtml =
          rep.status === "OPEN"
            ? `
              <div class="takedown-actions">
                <button type="button" class="row-action is-danger" data-takedown-action="takedown" data-report-id="${escapeHtml(rep.id)}">
                  <i data-lucide="trash-2"></i><span>Take Down Image</span>
                </button>
                ${
                  rep.tenantId
                    ? `<button type="button" class="row-action is-danger" data-takedown-action="takedown-suspend" data-report-id="${escapeHtml(rep.id)}">
                        <i data-lucide="shield-ban"></i><span>Take Down + Suspend Store</span>
                      </button>`
                    : ""
                }
                <button type="button" class="row-action is-more" data-takedown-action="dismiss" data-report-id="${escapeHtml(rep.id)}">
                  <span>Dismiss</span>
                </button>
              </div>
            `
            : `<p class="takedown-resolution-note">${escapeHtml(rep.resolutionNotes || `Resolved by ${rep.resolvedBy || "Super Admin"}`)}</p>`;

        const isExternal = isExternalPreviewUrl(previewSrc);

        return `
          <article class="takedown-report-card">
            <div class="takedown-thumb-wrap">
              ${
                previewSrc
                  ? `<button type="button" class="takedown-thumb-fallback" data-takedown-preview="${escapeHtml(previewSrc)}" style="cursor:pointer;border:0;background:transparent;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.25rem;" title="${isExternal ? "External URL — clicking will load directly from third-party server" : "Click to preview reported media"}">
                       <i data-lucide="eye" style="width:1rem;height:1rem;"></i>
                       <span>${isExternal ? "External preview" : "Preview image"}</span>
                     </button>`
                  : `<div class="takedown-thumb-fallback">No preview</div>`
              }
            </div>
            <div class="takedown-body">
              <div class="takedown-top-row">
                <span class="takedown-status-pill ${statusBadgeClass}">${statusText}</span>
                <span class="takedown-date">${escapeHtml(formatDate(rep.createdAt))}</span>
                ${rep.itemTitle ? `<strong class="takedown-item-title">${escapeHtml(rep.itemTitle)}</strong>` : ""}
                ${pageLink}
              </div>
              <div class="takedown-meta-grid">
                <div><strong>Store:</strong> ${escapeHtml(storeLabel)}</div>
                <div><strong>Reporter:</strong> ${escapeHtml(rep.reporterName)} (${escapeHtml(rep.reporterEmail)})</div>
                <div class="takedown-url-row"><strong>Reported Image:</strong> <code>${escapeHtml(rep.reportedImageUrl)}</code>${previewSrc ? ` <a href="${escapeHtml(previewSrc)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="takedown-proof-link">Open image ↗</a>` : ""}</div>
                ${proofLink ? `<div><strong>Original Proof:</strong> ${proofLink}</div>` : ""}
              </div>
              <p class="takedown-reason">${escapeHtml(rep.reason)}</p>
              ${actionsHtml}
            </div>
          </article>
        `;
      })
      .join("");

    if (window.lucide?.createIcons) window.lucide.createIcons();

    container.querySelectorAll("[data-takedown-preview]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const previewUrl = btn.dataset.takedownPreview || "";
        if (!previewUrl) return;
        if (isExternalPreviewUrl(previewUrl)) {
          const confirmed = await confirmDialog({
            title: "Load external image preview?",
            message:
              "This image is hosted on a third-party server. Loading it from your browser may expose your IP address and User-Agent to that server.",
            isDanger: false,
            confirmText: "Load Preview",
          });
          if (!confirmed) return;
        }
        const wrap = btn.closest(".takedown-thumb-wrap");
        if (!wrap) return;
        const img = document.createElement("img");
        img.src = previewUrl;
        img.alt = "Reported media";
        img.className = "takedown-thumb";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => {
          const fallback = document.createElement("div");
          fallback.className = "takedown-thumb-fallback";
          fallback.textContent = "Image removed / unavailable";
          wrap.replaceChildren(fallback);
        });
        wrap.replaceChildren(img);
      });
    });

    container.querySelectorAll("[data-takedown-action]").forEach((btn) => {
      btn.addEventListener("click", () => void handleReportAction(btn));
    });
  }

  async function handleReportAction(button) {
    const reportId = button.dataset.reportId;
    const action = button.dataset.takedownAction;
    const report = cachedReports.find((r) => r.id === reportId);
    if (!report) return;

    if (action === "dismiss") {
      const confirmed = await confirmDialog({
        title: "Dismiss copyright report?",
        message: "Mark this report as dismissed without removing the image.",
        isDanger: false,
        confirmText: "Dismiss report",
      });
      if (!confirmed) return;

      button.disabled = true;
      const res = await platformApiFetch(`/copyright-reports/${encodeURIComponent(reportId)}/dismiss`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      button.disabled = false;
      if (!res.ok || !res.data?.success) {
        if (res.status === 401) window.location.replace("./super-admin-login.html");
        setAdminNotice(res.data?.error?.message || "Could not dismiss report.", true);
        return;
      }
      setAdminNotice("Copyright report dismissed.");
      await window.loadCopyrightReports();
      return;
    }

    const suspendStore = action === "takedown-suspend";
    const confirmed = await confirmDialog({
      title: suspendStore ? "Take down image & suspend store?" : "Take down copyrighted image?",
      message: suspendStore
        ? `This immediately removes "${report.reportedImageUrl}" from store listings/R2 storage AND suspends the store.`
        : `This immediately strips "${report.reportedImageUrl}" from all store listings/branding and deletes the R2 image file.`,
      isDanger: true,
      confirmText: suspendStore ? "Take Down & Suspend" : "Take Down Image",
    });
    if (!confirmed) return;

    button.disabled = true;
    const origText = button.textContent;
    button.textContent = "Removing…";

    const res = await platformApiFetch(`/copyright-reports/${encodeURIComponent(reportId)}/takedown`, {
      method: "POST",
      body: JSON.stringify({ suspendStore }),
    });

    button.disabled = false;
    button.textContent = origText;

    if (!res.ok || !res.data?.success) {
      if (res.status === 401) window.location.replace("./super-admin-login.html");
      setAdminNotice(res.data?.error?.message || "Failed to execute image takedown.", true);
      return;
    }

    setAdminNotice(res.data.message || "Copyrighted image taken down.");
    await Promise.all([
      window.loadCopyrightReports(),
      typeof window.reloadSuperAdminDashboard === "function" ? window.reloadSuperAdminDashboard() : Promise.resolve(),
    ]);
  }

  async function handleDirectTakedownSubmit(event) {
    event.preventDefault();
    const urlInput = document.getElementById("direct-takedown-url");
    const subInput = document.getElementById("direct-takedown-subdomain");
    const noteInput = document.getElementById("direct-takedown-note");
    const suspendInput = document.getElementById("direct-takedown-suspend");
    const submitBtn = document.getElementById("direct-takedown-submit");

    const reportedImageUrl = (urlInput?.value || "").trim();
    const storeSubdomain = (subInput?.value || "").trim().toLowerCase() || undefined;
    const resolutionNotes = (noteInput?.value || "").trim() || undefined;
    const suspendStore = Boolean(suspendInput?.checked);

    if (reportedImageUrl.length < 3) {
      setAdminNotice("Enter the image URL to take down.", true);
      return;
    }

    const confirmed = await confirmDialog({
      title: suspendStore ? "Direct takedown & suspend store?" : "Direct copyrighted image takedown?",
      message: `Remove "${reportedImageUrl}" from storefront listings and delete it from R2 media storage${suspendStore ? " AND suspend the store" : ""}?`,
      isDanger: true,
      confirmText: "Execute Takedown",
    });
    if (!confirmed) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Taking down…";
    }

    const res = await platformApiFetch("/media/takedown", {
      method: "POST",
      body: JSON.stringify({
        reportedImageUrl,
        storeSubdomain,
        suspendStore,
        resolutionNotes,
      }),
    });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Take Down Image Now";
    }

    if (!res.ok || !res.data?.success) {
      if (res.status === 401) window.location.replace("./super-admin-login.html");
      setAdminNotice(res.data?.error?.message || "Direct takedown failed.", true);
      return;
    }

    document.getElementById("direct-takedown-form")?.reset();
    setAdminNotice(res.data.message || "Image taken down.");
    await window.loadCopyrightReports();
  }

  function bindCopyrightListeners() {
    if (listenersBound) return;
    listenersBound = true;

    document.querySelectorAll("[data-report-status]").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeReportStatus = tab.dataset.reportStatus || "OPEN";
        document.querySelectorAll("[data-report-status]").forEach((other) =>
          other.classList.toggle("is-selected", other === tab)
        );
        renderCopyrightReportsList();
      });
    });

    document
      .getElementById("direct-takedown-form")
      ?.addEventListener("submit", (event) => void handleDirectTakedownSubmit(event));
  }

  window.loadCopyrightReports = async function loadCopyrightReports() {
    bindCopyrightListeners();
    const res = await platformApiFetch("/copyright-reports?status=ALL");
    if (!res.ok || !res.data?.success) {
      if (res.status === 401) window.location.replace("./super-admin-login.html");
      const container = document.getElementById("copyright-reports-list");
      if (container) {
        container.innerHTML = `<div class="takedown-empty">Could not load copyright reports.</div>`;
      }
      return;
    }

    cachedReports = Array.isArray(res.data.data) ? res.data.data : [];
    updateReportCounts(res.data.counts || {});
    renderCopyrightReportsList();
  };
})();
