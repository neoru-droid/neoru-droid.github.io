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
          const coverLink = card.querySelector(".card-cover-link");
          if (freeAlt && coverLink) {
            freeAlt.removeAttribute("data-ea-free-btn");
            freeAlt.removeAttribute("target");
            freeAlt.removeAttribute("rel");
            freeAlt.className = "btn btn-secondary";
            freeAlt.href = coverLink.getAttribute("href") || "#";
            freeAlt.textContent = "Кадры и детали";
          }
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

  // Copy page link button for Telegram / Discord sharing
  const copyBtn = document.getElementById("copy-page-link");
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener("click", () => {
      const url = copyBtn.getAttribute("data-copy-url") || window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        const orig = copyBtn.textContent;
        copyBtn.textContent = "Ссылка скопирована ✓";
        setTimeout(() => { copyBtn.textContent = orig; }, 1800);
      }).catch(() => {});
    });
  }

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
      const fb = item.getAttribute("data-shot-fallback") || "";
      if (fb) lbImg.setAttribute("data-fallback", fb);
      lbImg.setAttribute("referrerpolicy", "no-referrer");
      lbImg.src = item.getAttribute("data-shot-src") || "";
      lbImg.alt = item.getAttribute("data-shot-cap") || "";
      lbCap.textContent = item.getAttribute("data-shot-cap") || "";
    }

    shotBtns.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        showShot(idx);
        lightbox.showModal();
        lightbox.focus({ preventScroll: true });
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
    return Boolean(q.trim() || state.type !== "all" || state.platform || state.sort !== "newest");
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

  function renderCard(game, idx) {
    const unlockMs = game.early_access_until ? Date.parse(game.early_access_until) : NaN;
    const isEarly = Number.isFinite(unlockMs) && unlockMs > Date.now();
    const eaBadge = isEarly
      ? `<div class="ea-badge" data-ea-until="${escapeHtml(String(unlockMs))}"><span class="ea-dot" aria-hidden="true"></span><span class="ea-clock">Ранний доступ · ${formatCountdown(unlockMs - Date.now())}</span></div>`
      : "";
    const boostyHref = withUtm(game.boosty_url, game.slug);
    const pageHref = `games/${encodeURIComponent(game.slug)}/`;
    const cleanGh = escapeHtml(String(game.github_url || "").replace(/\/$/, ""));
    const ghReleases = `${cleanGh}/releases/latest`;
    const freeLabel = game.has_translation ? "Русификатор · бесплатно ↗" : ".CT и сейв · бесплатно ↗";
    const ctaBtns = isEarly
      ? `<a class="btn btn-primary" href="${escapeHtml(boostyHref)}" target="_blank" rel="noopener">Мод-меню · 120 ₽ ↗</a>` +
        `<a class="btn btn-shelf" data-ea-free-btn="1" href="${ghReleases}" target="_blank" rel="noopener">${freeLabel}</a>`
      : `<a class="btn btn-shelf" href="${escapeHtml(boostyHref)}" target="_blank" rel="noopener"><span class="btn-free-dot" aria-hidden="true"></span>Бесплатно на Boosty <span class="btn-shelf-arrow" aria-hidden="true">↗</span></a>` +
        `<a class="btn btn-secondary" href="${pageHref}">Кадры и детали</a>`;
    const linksItems = isEarly
      ? `<a class="card-detail-link" href="${pageHref}">Кадры и детали</a><a class="card-ext-link" href="${cleanGh}" target="_blank" rel="noopener">GitHub</a>`
      : `<a class="card-ext-link" href="${cleanGh}" target="_blank" rel="noopener">GitHub</a>` +
        (game.steam_guide_url ? `<a class="card-ext-link" href="${escapeHtml(game.steam_guide_url)}" target="_blank" rel="noopener">Steam</a>` : "");
    const localWebp = `media/${escapeHtml(game.slug)}.webp`;
    const imgSrc = game.cover_cdn_url ? escapeHtml(game.cover_cdn_url) : localWebp;
    const fbAttr = game.cover_cdn_url ? ` data-fallback="${localWebp}"` : "";
    const loadAttr = idx < 3 ? ' fetchpriority="high"' : (idx >= 6 ? ' loading="lazy" decoding="async"' : "");
    const bgStyle = game.cover_color ? ` style="background:${escapeHtml(game.cover_color)}"` : "";

    return '<' + 'article class="card">' +
      `<a class="card-cover-link" href="${pageHref}"${bgStyle}>${eaBadge}` +
      `<img class="card-cover" src="${imgSrc}"${fbAttr} referrerpolicy="no-referrer" alt="${escapeHtml(game.title)}" width="680" height="382"${loadAttr}>` +
      `</a>` +
      `<div class="card-head"><h2 class="card-title"><a class="card-title-link" href="${pageHref}">${escapeHtml(game.title)}</a></h2>` +
      `<span class="card-ver">v${escapeHtml(game.version)} · ${escapeHtml(formatPlatforms(game))}</span></div>` +
      `<p class="card-summary">${escapeHtml(game.summary)}</p>` +
      `<div class="card-cta-bar">${ctaBtns}</div>` +
      `<div class="card-links">${linksItems}</div>` +
      `</article>`;
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

    grid.innerHTML = filtered.map((g, i) => renderCard(g, i)).join("");
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

  const hasInitialFilters = readUrlState();
  const embedded = document.getElementById("catalog-data");
  if (embedded && embedded.textContent) {
    try {
      state.games = JSON.parse(embedded.textContent);
      if (hasInitialFilters) applyFilters();
      return;
    } catch (_) {}
  }

  fetch("data/catalog.json")
    .then((r) => r.json())
    .then((items) => {
      state.games = Array.isArray(items) ? items : [];
      if (hasInitialFilters) applyFilters();
    })
    .catch(() => {
      countNode.textContent = "Ошибка загрузки каталога";
    });
})();
