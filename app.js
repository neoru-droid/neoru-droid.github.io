(function () {
  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function withUtm(rawUrl, slug) {
    const base = String(rawUrl || "").split("?")[0];
    const campaign = String(slug || "hub").replaceAll("-", "_");
    return `${base}?utm_source=catalog_site&utm_medium=web&utm_campaign=${encodeURIComponent(campaign)}`;
  }

  function formatCountdown(msLeft) {
    const totalSec = Math.max(0, Math.floor(msLeft / 1000));
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }

  function tickEarlyAccessTimers() {
    const timers = document.querySelectorAll("[data-ea-until]");
    if (!timers.length) return;
    const now = Date.now();
    timers.forEach((node) => {
      const unlockMs = Number(node.getAttribute("data-ea-until"));
      const diff = unlockMs - now;
      if (diff <= 0) {
        const card = node.closest(".card");
        if (card) {
          const freeAlt = card.querySelector("[data-ea-free-btn]");
          if (freeAlt) freeAlt.remove();
          const btn = card.querySelector(".btn-primary");
          if (btn) {
            btn.className = "btn btn-shelf";
            btn.innerHTML = '<span class="btn-free-dot" aria-hidden="true"></span>Бесплатно на Boosty <span class="btn-shelf-arrow" aria-hidden="true">↗</span>';
          }
        }
        const heroBox = node.closest(".game-cta-box");
        if (heroBox) {
          const heroBtn = heroBox.querySelector(".btn-primary");
          if (heroBtn) heroBtn.textContent = "Скачать бесплатно на Boosty ↗";
          const split = heroBox.querySelector(".ea-split");
          if (split) split.remove();
        }
        node.remove();
        return;
      }
      const clock = node.querySelector(".ea-clock");
      if (clock) {
        clock.textContent = node.classList.contains("ea-inline")
          ? `Ранний доступ · откроется бесплатно всем через ${formatCountdown(diff)}`
          : `Ранний доступ · ${formatCountdown(diff)}`;
      }
    });
  }

  tickEarlyAccessTimers();
  setInterval(tickEarlyAccessTimers, 1000);

  // Per-game page interactions: platform tabs, screenshot lightbox, mobile sticky CTA
  const tabList = document.querySelector("[role='tablist']");
  if (tabList) {
    const tabs = Array.from(tabList.querySelectorAll("[role='tab']"));
    const panels = Array.from(document.querySelectorAll("[role='tabpanel']"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("aria-controls");
        tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        panels.forEach((p) => { p.hidden = p.id !== targetId; });
      });
    });
  }

  const shotBtns = Array.from(document.querySelectorAll(".shot-card[data-shot-src]"));
  const lightbox = document.getElementById("shot-lightbox");
  if (shotBtns.length && lightbox && typeof lightbox.showModal === "function") {
    const lbImg = document.getElementById("lightbox-img");
    const lbCap = document.getElementById("lightbox-cap");
    const lbPrev = document.getElementById("lightbox-prev");
    const lbNext = document.getElementById("lightbox-next");
    const lbClose = document.getElementById("lightbox-close");
    let activeIdx = 0;

    function showShot(idx) {
      activeIdx = (idx + shotBtns.length) % shotBtns.length;
      const item = shotBtns[activeIdx];
      lbImg.src = item.getAttribute("data-shot-src") || "";
      lbImg.alt = item.getAttribute("data-shot-cap") || "";
      lbCap.textContent = item.getAttribute("data-shot-cap") || "";
    }

    shotBtns.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        showShot(idx);
        lightbox.showModal();
      });
    });
    if (lbPrev) lbPrev.addEventListener("click", () => showShot(activeIdx - 1));
    if (lbNext) lbNext.addEventListener("click", () => showShot(activeIdx + 1));
    if (lbClose) lbClose.addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.close();
    });
    document.addEventListener("keydown", (e) => {
      if (!lightbox.open) return;
      if (e.key === "ArrowLeft") showShot(activeIdx - 1);
      if (e.key === "ArrowRight") showShot(activeIdx + 1);
    });
  }

  const heroCta = document.getElementById("hero-boosty-cta");
  const mobileBar = document.getElementById("mobile-cta-bar");
  if (heroCta && mobileBar && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        mobileBar.classList.toggle("is-docked-hidden", entry.isIntersecting);
      });
    }, { threshold: 0.15 });
    io.observe(heroCta);
  }

  // Home shelf search, filters, URL sync & keyboard shortcut
  const grid = document.getElementById("games-grid");
  const searchInput = document.getElementById("search-input");
  if (!grid || !searchInput) return;

  const clearBtn = document.getElementById("search-clear");
  const kbdHint = document.getElementById("search-kbd");
  const countNode = document.getElementById("results-count");
  const sortSelect = document.getElementById("sort-select");
  const emptyState = document.getElementById("empty-state");
  const resetBtn = document.getElementById("reset-filters");
  const typeBtns = Array.from(document.querySelectorAll("[data-type]"));
  const platformBtns = Array.from(document.querySelectorAll("[data-platform]"));

  const state = { query: "", type: "all", platform: "", sort: "newest", games: [] };

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    const t = params.get("type") || "all";
    const p = params.get("platform") || "";
    const s = params.get("sort") || "newest";
    state.query = q;
    state.type = ["all", "translation", "mod"].includes(t) ? t : "all";
    state.platform = p === "macos" ? "macos" : "";
    state.sort = s === "alpha" ? "alpha" : "newest";
    searchInput.value = state.query;
    sortSelect.value = state.sort;
    syncFilterButtons();
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.type !== "all") params.set("type", state.type);
    if (state.platform) params.set("platform", state.platform);
    if (state.sort !== "newest") params.set("sort", state.sort);
    const qs = params.toString();
    const nextUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", nextUrl);
  }

  function syncFilterButtons() {
    typeBtns.forEach((b) => b.classList.toggle("is-active", (b.dataset.type || "all") === state.type));
    platformBtns.forEach((b) => b.classList.toggle("is-active", (b.dataset.platform || "") === state.platform));
    const hasQuery = state.query.length > 0;
    if (clearBtn) clearBtn.hidden = !hasQuery;
    if (kbdHint) kbdHint.hidden = hasQuery;
  }

  function formatPlatforms(game) {
    const plat = ["Win"];
    if (game.platforms && game.platforms.steamdeck) plat.push("Deck");
    if (game.platforms && game.platforms.macos) plat.push("macOS");
    return plat.join(", ");
  }

  function renderCard(game) {
    const unlockMs = game.early_access_until ? Date.parse(game.early_access_until) : NaN;
    const isEarly = Number.isFinite(unlockMs) && unlockMs > Date.now();
    const eaBadge = isEarly
      ? `<div class="ea-badge" data-ea-until="${escapeHtml(String(unlockMs))}"><span class="ea-dot" aria-hidden="true"></span><span class="ea-clock">Ранний доступ · ${formatCountdown(unlockMs - Date.now())}</span></div>`
      : "";
    const boostyHref = withUtm(game.boosty_url, game.slug);
    const ghReleases = `${escapeHtml(String(game.github_url || "").replace(/\/$/, ""))}/releases/latest`;
    const ctaBtns = isEarly
      ? `<a class="btn btn-primary" href="${escapeHtml(boostyHref)}" target="_blank" rel="noopener">Мод-меню · 120 ₽ ↗</a>` +
        `<a class="btn btn-shelf" data-ea-free-btn="1" href="${ghReleases}" target="_blank" rel="noopener">.CT и сейв · бесплатно ↗</a>`
      : `<a class="btn btn-shelf" href="${escapeHtml(boostyHref)}" target="_blank" rel="noopener"><span class="btn-free-dot" aria-hidden="true"></span>Бесплатно на Boosty <span class="btn-shelf-arrow" aria-hidden="true">↗</span></a>`;
    const pageHref = `games/${encodeURIComponent(game.slug)}/`;
    const ghLink = isEarly
      ? ""
      : `<a class="card-ext-link" href="${escapeHtml(game.github_url)}" target="_blank" rel="noopener">GitHub</a>`;
    const steamLink = game.steam_guide_url
      ? `<a class="card-ext-link" href="${escapeHtml(game.steam_guide_url)}" target="_blank" rel="noopener">Steam</a>`
      : "";

    return `<article class="card">` +
      `<a class="card-cover-link" href="${pageHref}">${eaBadge}` +
      `<img class="card-cover" src="media/${escapeHtml(game.slug)}.jpg" alt="${escapeHtml(game.title)}" width="800" height="450" loading="lazy">` +
      `</a>` +
      `<div class="card-body">` +
      `<div class="card-head"><h2 class="card-title"><a class="card-title-link" href="${pageHref}">${escapeHtml(game.title)}</a></h2>` +
      `<span class="card-ver">v${escapeHtml(game.version)} · ${escapeHtml(formatPlatforms(game))}</span></div>` +
      `<p class="card-summary">${escapeHtml(game.summary)}</p>` +
      `<div class="card-actions">${ctaBtns}` +
      `<a class="card-detail-link" href="${pageHref}">Кадры и детали</a>${ghLink}${steamLink}` +
      `</div></div></article>`;
  }

  function applyFilters() {
    syncFilterButtons();
    writeUrlState();
    const q = state.query.trim().toLowerCase();
    const filtered = state.games.filter((g) => {
      if (state.type === "translation" && !g.has_translation) return false;
      if (state.type === "mod" && !(g.has_mod_menu || g.has_ct)) return false;
      if (state.platform === "macos" && !(g.platforms && g.platforms.macos)) return false;
      if (!q) return true;
      const implicit = [];
      if (g.has_translation) implicit.push("русификатор перевод шрифт локализация");
      if (g.has_mod_menu || g.has_ct) implicit.push("мод меню трейнер чит таблица сохранение");
      const hay = [g.title, g.summary, ...(g.features || []), ...(g.keywords || []), ...implicit].join(" ").toLowerCase();
      return hay.includes(q);
    });

    if (state.sort === "alpha") {
      filtered.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    } else {
      filtered.reverse();
    }

    grid.innerHTML = filtered.map(renderCard).join("");
    countNode.textContent = "Показано: " + filtered.length;
    emptyState.hidden = filtered.length > 0;
  }

  typeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.type = btn.dataset.type || "all";
      applyFilters();
    });
  });

  platformBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.platform || "";
      state.platform = state.platform === target ? "" : target;
      applyFilters();
    });
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    applyFilters();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.query = "";
      searchInput.value = "";
      searchInput.focus();
      applyFilters();
    });
  }

  document.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (e.key === "/" && activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
      e.preventDefault();
      searchInput.focus();
    }
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    applyFilters();
  });

  resetBtn.addEventListener("click", () => {
    state.query = "";
    state.type = "all";
    state.platform = "";
    state.sort = "newest";
    searchInput.value = "";
    sortSelect.value = "newest";
    applyFilters();
  });

  readUrlState();

  fetch("data/catalog.json")
    .then((r) => r.json())
    .then((items) => {
      state.games = Array.isArray(items) ? items : [];
      applyFilters();
    })
    .catch(() => {
      countNode.textContent = "Ошибка загрузки каталога";
    });
})();
