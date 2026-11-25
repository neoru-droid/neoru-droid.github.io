(function () {
  const grid = document.getElementById("games-grid");
  const searchInput = document.getElementById("search-input");
  const countNode = document.getElementById("results-count");
  const sortSelect = document.getElementById("sort-select");
  const emptyState = document.getElementById("empty-state");
  const resetBtn = document.getElementById("reset-filters");
  const typeBtns = Array.from(document.querySelectorAll("[data-type]"));
  const platformBtn = document.querySelector("[data-platform='macos']");

  const state = { query: "", type: "all", macosOnly: false, sort: "alpha", games: [] };

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderCard(game) {
    const badges = [];
    if (game.has_translation) badges.push('<span class="badge badge-ru">Русификатор</span>');
    if (game.has_mod_menu) badges.push('<span class="badge badge-mod">Мод-меню</span>');
    if (game.has_ct) badges.push('<span class="badge badge-mod">Таблица .CT</span>');
    if (game.platforms && game.platforms.steamdeck) badges.push('<span class="badge">Steam Deck</span>');
    if (game.platforms && game.platforms.macos) badges.push('<span class="badge">macOS</span>');

    const secLinks = [
      `<a href="${escapeHtml(game.github_url)}" target="_blank" rel="noopener">GitHub</a>`
    ];
    if (game.steam_guide_url) {
      secLinks.push(`<a href="${escapeHtml(game.steam_guide_url)}" target="_blank" rel="noopener">Руководство Steam</a>`);
    }
    if (game.zog_url) {
      secLinks.push(`<a href="${escapeHtml(game.zog_url)}" target="_blank" rel="noopener">Zone of Games</a>`);
    }

    return `
      <article class="card">
        <img class="card-cover" src="media/${escapeHtml(game.slug)}.jpg" alt="${escapeHtml(game.title)}" width="800" height="450" loading="lazy">
        <div class="card-body">
          <div class="card-head">
            <h2 class="card-title">${escapeHtml(game.title)}</h2>
            <span class="card-ver">v${escapeHtml(game.version)}</span>
          </div>
          <div class="badges">${badges.join("")}</div>
          <p class="card-summary">${escapeHtml(game.summary)}</p>
          <div class="card-actions">
            <a class="btn btn-primary" href="${escapeHtml(game.boosty_url)}" target="_blank" rel="noopener">Скачать на Boosty</a>
            <div class="card-links">${secLinks.join("")}</div>
          </div>
        </div>
      </article>`;
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    const filtered = state.games.filter((g) => {
      if (state.type === "translation" && !g.has_translation) return false;
      if (state.type === "mod" && !(g.has_mod_menu || g.has_ct)) return false;
      if (state.macosOnly && !(g.platforms && g.platforms.macos)) return false;
      if (!q) return true;
      const hay = [g.title, g.summary, ...(g.features || []), ...(g.keywords || [])].join(" ").toLowerCase();
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
      typeBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      applyFilters();
    });
  });

  if (platformBtn) {
    platformBtn.addEventListener("click", () => {
      state.macosOnly = !state.macosOnly;
      platformBtn.classList.toggle("is-active", state.macosOnly);
      applyFilters();
    });
  }

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    applyFilters();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    applyFilters();
  });

  resetBtn.addEventListener("click", () => {
    state.query = "";
    state.type = "all";
    state.macosOnly = false;
    state.sort = "alpha";
    searchInput.value = "";
    sortSelect.value = "alpha";
    typeBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.type === "all"));
    if (platformBtn) platformBtn.classList.remove("is-active");
    applyFilters();
  });

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
