const state = {
  route: "home",
  adminTab: "dashboard",
  adminDramaStatus: "",
  rankTab: "views",
  rankStatus: "",
  dramas: [],
  adminDramas: [],
  rankings: [],
  favorites: [],
  watchHistory: [],
  selectedDrama: null,
  currentEpisode: 1,
  filter: "全部",
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  stats: null,
  users: [],
  orders: []
};

const app = document.querySelector("#app");

let _handling401 = false;

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function handleUnauthorized() {
  if (_handling401) return;
  _handling401 = true;
  clearSession();
  toast("登录已过期，请重新登录");
  setTimeout(() => {
    _handling401 = false;
    route("login");
  }, 300);
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (res) => {
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("请先登录");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "请求失败");
    return data;
  });
}

function formatNumber(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1900);
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  clearSession();
  route("home");
}

function route(name, payload) {
  state.route = name;
  if (payload) state.selectedDrama = payload;
  render();
}

async function loadDramas() {
  const data = await api("/api/dramas");
  state.dramas = data.dramas;
}

async function loadAdminDramas(status) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const data = await api(`/api/admin/dramas?${params.toString()}`);
  state.adminDramas = data.dramas;
}

async function loadAdmin() {
  const data = await api("/api/admin/stats");
  state.stats = data.stats;
  state.users = data.users;
  state.orders = data.orders;
}

async function loadRankings(type, status) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const data = await api(`/api/rankings?${params.toString()}`);
  state.rankings = data.rankings;
}

async function loadFavorites() {
  if (!state.user) return;
  const data = await api("/api/favorites");
  state.favorites = data.dramas;
}

async function loadHistory() {
  if (!state.user) return;
  const data = await api("/api/history");
  state.watchHistory = data.history;
}

async function addToHistory(dramaId, episode, progress) {
  if (!state.user) return;
  try {
    await api("/api/history", {
      method: "POST",
      body: JSON.stringify({ dramaId, episode, progress })
    });
  } catch (e) {
    console.warn("记录观看历史失败", e);
  }
}

async function removeFromHistory(dramaId) {
  if (!state.user) return;
  await api(`/api/history/${dramaId}`, { method: "DELETE" });
  state.watchHistory = state.watchHistory.filter((item) => item.id !== dramaId);
}

async function clearAllHistory() {
  if (!state.user) return;
  await api("/api/history", { method: "DELETE" });
  state.watchHistory = [];
}

function formatWatchedAt(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">▶</span><span>星幕短剧</span></div>
      <nav class="tabs">
        <button class="tab ${state.route === "home" ? "active" : ""}" data-route="home">精选短剧</button>
        <button class="tab ${state.route === "rankings" ? "active" : ""}" data-route="rankings">热播榜</button>
        <button class="tab ${state.route === "history" ? "active" : ""}" data-route="history">观看历史</button>
        <button class="tab ${state.route === "favorites" ? "active" : ""}" data-route="favorites">我的收藏</button>
        <button class="tab ${state.route === "detail" ? "active" : ""}" data-featured-detail>播放大厅</button>
        <button class="tab ${state.route === "admin" ? "active" : ""}" data-route="admin">后台管理</button>
      </nav>
      <div class="toolbar">
        ${
          state.user
            ? `<span class="muted">${state.user.name}</span><button class="ghost-btn" data-logout>退出</button>`
            : `<button class="primary-btn" data-route="login">登录</button>`
        }
      </div>
    </header>
  `;
}

function home() {
  const featured = state.dramas[0];
  const genres = ["全部", ...new Set(state.dramas.map((drama) => drama.genre))];
  const dramas = state.filter === "全部" ? state.dramas : state.dramas.filter((drama) => drama.genre === state.filter);
  const recentHistory = state.user ? state.watchHistory.slice(0, 4) : [];
  return `
    ${topbar()}
    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">短剧发行 · 会员观看 · 运营后台</p>
          <h1>星幕短剧平台</h1>
          <p>把热门短剧、会员资产和内容运营放在同一个系统里。前台适合用户浏览追剧，后台适合运营团队管理剧集、订单和数据。</p>
          <div class="hero-actions">
            <button class="primary-btn" data-featured-detail>立即追剧</button>
            <button class="ghost-btn" data-route="admin">进入后台</button>
          </div>
        </div>
        <aside class="feature-panel">
          <div class="feature-image" style="background-image:url('${featured?.cover || ""}')"></div>
          <div class="feature-body">
            <div class="meta-row"><span class="pill">${featured?.status || ""}</span><span class="pill">${featured?.genre || ""}</span><span class="pill">${featured?.rating || ""} 分</span></div>
            <h2>${featured?.title || ""}</h2>
            <p>${featured?.synopsis || ""}</p>
          </div>
        </aside>
      </section>
      ${recentHistory.length ? `
      <section class="section">
        <div class="section-head">
          <div>
            <h2>继续观看</h2>
            <p class="muted">从上次离开的地方，继续追剧。</p>
          </div>
          <div>
            <button class="chip" data-route="history">查看全部</button>
          </div>
        </div>
        <div class="recent-grid">
          ${recentHistory.map((drama) => `
            <article class="recent-card" data-detail="${drama.id}" data-episode="${drama.episode || 1}">
              <div class="recent-poster" style="background-image:url('${drama.cover}')">
                <span class="badge">${drama.status}</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${drama.progress || 0}%"></div></div>
                <div class="recent-play">▶ 第 ${drama.episode || 1} 集</div>
              </div>
              <div class="recent-body">
                <h3 class="card-title small-title">${drama.title}</h3>
                <p class="muted small">${formatWatchedAt(drama.watchedAt)} · ${drama.genre}</p>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
      ` : ""}
      <section class="section">
        <div class="section-head">
          <div>
            <h2>精选短剧</h2>
            <p class="muted">按题材快速筛选，支持收藏和播放详情。</p>
          </div>
          <div class="filters">
            ${genres.map((genre) => `<button class="chip ${genre === state.filter ? "active" : ""}" data-filter="${genre}">${genre}</button>`).join("")}
          </div>
        </div>
        <div class="grid">
          ${dramas.map(dramaCard).join("")}
        </div>
      </section>
    </main>
  `;
}

function dramaCard(drama) {
  const liked = state.user?.favorites?.includes(drama.id);
  const statusColors = {
    "上新": "#1971c2",
    "热播": "#e84363",
    "完结": "#495057",
    "下架": "#c92a2a"
  };
  return `
    <article class="drama-card">
      <div class="poster" style="background-image:url('${drama.cover}')">
        <span class="badge" style="background:${statusColors[drama.status] || "rgba(16,24,38,0.76)"}">${drama.status}</span>
        <span class="price-badge">${money(drama.price)}</span>
        <div class="rating-wrap">
          <span class="rating-star">★</span>
          <span class="rating-score">${drama.rating}</span>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${drama.title}</h3>
        <div class="info-grid">
          <div class="info-item info-genre">
            <span class="info-icon">📺</span>
            <span class="info-label">题材</span>
            <span class="info-value">${drama.genre}</span>
          </div>
          <div class="info-item info-episodes">
            <span class="info-icon">🎬</span>
            <span class="info-label">集数</span>
            <span class="info-value">${drama.episodes} 集</span>
          </div>
          <div class="info-item info-price">
            <span class="info-icon">💰</span>
            <span class="info-label">定价</span>
            <span class="info-value">${money(drama.price)}</span>
          </div>
          <div class="info-item info-views">
            <span class="info-icon">👁</span>
            <span class="info-label">播放</span>
            <span class="info-value">${formatNumber(drama.views)}</span>
          </div>
        </div>
        <div class="tags-row">
          ${drama.tags.map((tag) => `<span class="tag-pill">#${tag}</span>`).join("")}
        </div>
        <p class="synopsis-text">${drama.synopsis}</p>
        <div class="card-actions">
          <button class="primary-btn" data-detail="${drama.id}">▶ 播放</button>
          <button class="ghost-btn" data-fav="${drama.id}">${liked ? "★ 已收藏" : "☆ 收藏"}</button>
        </div>
      </div>
    </article>
  `;
}

function rankingCard(drama, rank) {
  const rankColors = ["#e84363", "#e4a42f", "#0f9f9a"];
  const rankBg = rank <= 3 ? rankColors[rank - 1] : "#627084";
  return `
    <article class="ranking-card" data-detail="${drama.id}">
      <div class="rank-num" style="background:${rankBg}">${rank}</div>
      <div class="ranking-poster" style="background-image:url('${drama.cover}')">
        <span class="badge">${drama.status}</span>
      </div>
      <div class="ranking-body">
        <h3 class="card-title">${drama.title}</h3>
        <div class="meta-row ranking-meta">
          <span class="pill dark">${drama.genre}</span>
          <span class="pill dark">${drama.episodes} 集</span>
          <span class="pill dark rating-pill">★ ${drama.rating}</span>
          <span class="pill dark">${formatNumber(drama.views)} 播放</span>
        </div>
        <p class="ranking-synopsis">${drama.synopsis}</p>
        <div class="ranking-actions">
          <button class="primary-btn" data-detail="${drama.id}">立即播放</button>
        </div>
      </div>
    </article>
  `;
}

function rankings() {
  const rankTabs = [
    { key: "views", label: "热播榜", desc: "按播放量排行，发现最热门短剧" },
    { key: "rating", label: "好评榜", desc: "按评分排行，发现高口碑佳作" },
    { key: "revenue", label: "畅销榜", desc: "按收入排行，发现最具价值内容" }
  ];
  const statusTabs = [
    { key: "", label: "全部" },
    { key: "热播", label: "热播中" },
    { key: "完结", label: "已完结" },
    { key: "上新", label: "新上线" }
  ];
  return `
    ${topbar()}
    <main>
      <section class="rank-hero">
        <div>
          <p class="eyebrow">榜单运营位</p>
          <h1>热播榜</h1>
          <p class="muted rank-desc">多维度榜单快速发现高热度短剧，数据实时更新，让好内容不被错过。</p>
        </div>
      </section>
      <section class="section">
        <div class="rank-toolbar">
          <div class="rank-tabs">
            ${rankTabs.map((tab) => `
              <button class="rank-tab ${tab.key === state.rankTab ? "active" : ""}" data-rank-tab="${tab.key}">
                <span class="rank-tab-label">${tab.label}</span>
                <span class="rank-tab-desc">${tab.desc}</span>
              </button>
            `).join("")}
          </div>
          <div class="status-filters">
            <span class="status-filter-label">状态筛选</span>
            <div class="status-filter-chips">
              ${statusTabs.map((tab) => `
                <button class="status-chip ${(tab.key === state.rankStatus) ? "active" : ""}" data-rank-status="${tab.key}">
                  ${tab.label}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
        <div class="ranking-list">
          ${state.rankings.length ? state.rankings.map((drama, index) => rankingCard(drama, index + 1)).join("") : `<div class="empty-state"><p>暂无符合条件的短剧</p></div>`}
        </div>
      </section>
    </main>
  `;
}

function favorites() {
  if (!state.user) {
    return `
      ${topbar()}
      <main class="login-wrap">
        <section class="login-panel">
          <p class="eyebrow">我的收藏</p>
          <h2>请先登录</h2>
          <p class="muted">登录后即可查看和管理你收藏的短剧。</p>
          <button class="primary-btn" data-route="login" style="margin-top:16px">立即登录</button>
        </section>
      </main>
    `;
  }
  return `
    ${topbar()}
    <main>
      <section class="favorites-hero">
        <div>
          <p class="eyebrow">追剧清单</p>
          <h1>我的收藏</h1>
          <p class="muted fav-desc">已收藏 <strong class="fav-count">${state.favorites.length}</strong> 部短剧，随时继续追剧。</p>
        </div>
      </section>
      <section class="section">
        ${state.favorites.length ? `
          <div class="favorites-list">
            ${state.favorites.map((drama) => `
              <article class="favorite-card">
                <div class="favorite-poster" style="background-image:url('${drama.cover}')">
                  <span class="badge">${drama.status}</span>
                  <span class="rating">${drama.rating}</span>
                </div>
                <div class="favorite-body">
                  <div class="favorite-header">
                    <div>
                      <h3 class="card-title">${drama.title}</h3>
                      <div class="meta-row fav-meta">
                        <span class="pill dark">${drama.genre}</span>
                        <span class="pill dark">${drama.episodes} 集</span>
                        <span class="pill dark">${formatNumber(drama.views)} 播放</span>
                      </div>
                    </div>
                  </div>
                  <p class="favorite-synopsis">${drama.synopsis}</p>
                  <div class="favorite-actions">
                    <button class="primary-btn" data-detail="${drama.id}">立即播放</button>
                    <button class="ghost-btn" data-fav="${drama.id}">取消收藏</button>
                  </div>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="empty-favorites">
            <div class="empty-icon">☆</div>
            <h3>还没有收藏的短剧</h3>
            <p class="muted">去发现好剧，把喜欢的短剧加入收藏吧。</p>
            <button class="primary-btn" data-route="home">发现短剧</button>
          </div>
        `}
      </section>
    </main>
  `;
}

function history() {
  if (!state.user) {
    return `
      ${topbar()}
      <main class="login-wrap">
        <section class="login-panel">
          <p class="eyebrow">用户观影足迹</p>
          <h2>请先登录</h2>
          <p class="muted">登录后即可查看你的观看历史，继续追剧。</p>
          <button class="primary-btn" data-route="login" style="margin-top:16px">立即登录</button>
        </section>
      </main>
    `;
  }
  return `
    ${topbar()}
    <main>
      <section class="history-hero">
        <div>
          <p class="eyebrow">用户观影足迹</p>
          <h1>观看历史</h1>
          <p class="muted history-desc">共观看 <strong class="history-count">${state.watchHistory.length}</strong> 部短剧，继续你的追剧之旅。</p>
        </div>
        ${state.watchHistory.length ? `
          <div class="history-actions">
            <button class="ghost-btn danger-btn" data-clear-history>清空历史</button>
          </div>
        ` : ""}
      </section>
      <section class="section">
        ${state.watchHistory.length ? `
          <div class="history-list">
            ${state.watchHistory.map((drama) => `
              <article class="history-card">
                <div class="history-poster" style="background-image:url('${drama.cover}')" data-detail="${drama.id}">
                  <span class="badge">${drama.status}</span>
                  <span class="rating">${drama.rating}</span>
                  <div class="progress-bar"><div class="progress-fill" style="width:${drama.progress || 0}%"></div></div>
                  <div class="continue-badge">
                    <span class="continue-ep">第 ${drama.episode || 1} 集</span>
                  </div>
                </div>
                <div class="history-body">
                  <div class="history-header">
                    <div>
                      <h3 class="card-title" data-detail="${drama.id}">${drama.title}</h3>
                      <div class="meta-row history-meta">
                        <span class="pill dark">${drama.genre}</span>
                        <span class="pill dark">${drama.episodes} 集</span>
                        <span class="pill dark">${formatNumber(drama.views)} 播放</span>
                        <span class="pill dark watched-time">🕒 ${formatWatchedAt(drama.watchedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <p class="history-synopsis">${drama.synopsis}</p>
                  <div class="progress-info">
                    <span>观看进度：第 ${drama.episode || 1} 集</span>
                    <span class="muted">已看 ${drama.progress || 0}%</span>
                  </div>
                  <div class="history-actions-row">
                    <button class="primary-btn" data-detail="${drama.id}" data-episode="${drama.episode || 1}">继续观看</button>
                    <button class="ghost-btn" data-fav="${drama.id}">${state.user?.favorites?.includes(drama.id) ? "已收藏" : "收藏"}</button>
                    <button class="ghost-btn danger-text" data-remove-history="${drama.id}">删除记录</button>
                  </div>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="empty-history">
            <div class="empty-icon">📺</div>
            <h3>暂无观看记录</h3>
            <p class="muted">去发现好剧，开始你的追剧之旅吧。</p>
            <button class="primary-btn" data-route="home">发现短剧</button>
          </div>
        `}
      </section>
    </main>
  `;
}

function detail() {
  const drama = state.selectedDrama || state.dramas[0];
  if (!drama) return `${topbar()}<main class="section"><p>暂无短剧</p></main>`;
  const currentEp = state.currentEpisode || 1;
  const historyRecord = state.watchHistory.find((h) => h.id === drama.id);
  const lastEpisode = historyRecord?.episode || 1;
  return `
    ${topbar()}
    <main class="section detail-layout">
      <aside class="detail-panel">
        <img class="detail-cover" src="${drama.cover}" alt="${drama.title}" />
        ${historyRecord ? `
          <div class="detail-history">
            <p class="muted small">上次看到：第 ${lastEpisode} 集 · ${formatWatchedAt(historyRecord.watchedAt)}</p>
            <button class="ghost-btn continue-last-btn" data-continue-last="${lastEpisode}">继续观看</button>
          </div>
        ` : ""}
      </aside>
      <section class="detail-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">${drama.genre} · ${drama.status}</p>
            <h1>${drama.title}</h1>
            <p class="muted">${drama.synopsis}</p>
          </div>
        </div>
        <div class="player-box">
          <div>
            <div class="play-symbol">▶</div>
            <h2>第 ${currentEp} 集</h2>
            <p>会员权益已模拟开通，可直接播放。</p>
          </div>
        </div>
        <div class="meta-row" style="margin-top:16px">
          <span class="pill">${drama.rating} 分</span>
          <span class="pill">${formatNumber(drama.views)} 播放</span>
          <span class="pill">${money(drama.price)} 全剧</span>
          ${drama.tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
        </div>
        <div class="episode-grid">
          ${Array.from({ length: Math.min(drama.episodes, 32) }, (_, index) => {
            const ep = index + 1;
            return `<button class="${ep === currentEp ? "active" : ""}" data-episode="${ep}">${ep}</button>`;
          }).join("")}
        </div>
      </section>
    </main>
  `;
}

function login() {
  return `
    ${topbar()}
    <main class="login-wrap">
      <section class="login-panel">
        <p class="eyebrow">账号登录</p>
        <h2>进入星幕短剧</h2>
        <form class="form-grid" data-login-form>
          <label>账号<input name="username" value="admin" autocomplete="username" /></label>
          <label>密码<input name="password" value="admin123" type="password" autocomplete="current-password" /></label>
          <button class="primary-btn">登录</button>
        </form>
        <p class="muted" style="margin-top:14px">管理员：admin / admin123；用户：viewer / viewer123</p>
      </section>
    </main>
  `;
}

function admin() {
  if (!state.user) return login();
  if (state.user.role !== "admin") {
    return `${topbar()}<main class="section"><section class="detail-panel"><h2>需要管理员权限</h2><p class="muted">请使用 admin / admin123 登录后台。</p></section></main>`;
  }
  const stats = state.stats || { dramas: 0, users: 0, orders: 0, revenue: 0, views: 0 };
  return `
    ${topbar()}
    <main class="admin-layout">
      <aside class="sidebar">
        <button class="side-btn ${state.adminTab === "dashboard" ? "active" : ""}" data-admin-tab="dashboard">数据看板</button>
        <button class="side-btn ${state.adminTab === "dramas" ? "active" : ""}" data-admin-tab="dramas">短剧管理</button>
        <button class="side-btn ${state.adminTab === "orders" ? "active" : ""}" data-admin-tab="orders">订单用户</button>
      </aside>
      <section class="admin-main">
        <div class="stats">
          <div class="stat-card"><span class="muted">短剧数</span><strong>${stats.dramas}</strong></div>
          <div class="stat-card"><span class="muted">用户数</span><strong>${stats.users}</strong></div>
          <div class="stat-card"><span class="muted">订单数</span><strong>${stats.orders}</strong></div>
          <div class="stat-card"><span class="muted">收入</span><strong>${money(stats.revenue)}</strong></div>
          <div class="stat-card"><span class="muted">播放</span><strong>${formatNumber(stats.views)}</strong></div>
        </div>
        ${state.adminTab === "dashboard" ? adminDashboard() : ""}
        ${state.adminTab === "dramas" ? adminDramas() : ""}
        ${state.adminTab === "orders" ? adminOrders() : ""}
      </section>
    </main>
  `;
}

function adminDashboard() {
  return `
    <section class="admin-panel">
      <div class="section-head"><div><h2>内容表现</h2><p class="muted">按播放量和收入观察短剧表现。</p></div></div>
      <table>
        <thead><tr><th>短剧</th><th>题材</th><th>播放</th><th>收入</th><th>评分</th></tr></thead>
        <tbody>${state.dramas.map((drama) => `<tr><td>${drama.title}</td><td>${drama.genre}</td><td>${formatNumber(drama.views)}</td><td>${money(drama.revenue)}</td><td>${drama.rating}</td></tr>`).join("")}</tbody>
      </table>
    </section>
  `;
}

function adminDramas() {
  const statusTabs = [
    { key: "", label: "全部" },
    { key: "上新", label: "上新" },
    { key: "热播", label: "热播" },
    { key: "完结", label: "完结" },
    { key: "下架", label: "下架" }
  ];
  const dramas = state.adminDramas.length ? state.adminDramas : state.dramas;
  return `
    <div class="admin-dramas-wrapper">
      <section class="admin-panel">
        <div class="section-head">
          <div>
            <h2>短剧列表</h2>
            <p class="muted">支持上下架、状态筛选和新增短剧。</p>
          </div>
          <div class="admin-status-filters">
            ${statusTabs.map((tab) => `
              <button class="status-chip ${tab.key === state.adminDramaStatus ? "active" : ""}" data-admin-status="${tab.key}">
                ${tab.label}
              </button>
            `).join("")}
          </div>
        </div>
        <table class="drama-admin-table">
          <thead><tr><th>名称</th><th>状态</th><th>集数</th><th>定价</th><th>播放量</th><th>操作</th></tr></thead>
          <tbody>
            ${dramas.map((drama) => `
              <tr class="${drama.status === '下架' ? 'drama-offline' : ''}">
                <td>${drama.title}</td>
                <td><span class="status-badge status-${drama.status}">${drama.status}</span></td>
                <td>${drama.episodes}</td>
                <td>${money(drama.price)}</td>
                <td>${formatNumber(drama.views)}</td>
                <td class="drama-actions">
                  ${drama.status === '下架'
                    ? `<button class="success-btn" data-restore="${drama.id}">上架</button>`
                    : `<button class="warning-btn" data-offline="${drama.id}">下架</button>`
                  }
                  <button class="danger-btn" data-delete="${drama.id}">删除</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
      <section class="admin-panel">
        <h2>新增短剧</h2>
        <form class="form-grid" data-create-form>
          <label>名称<input name="title" required /></label>
          <label>题材<input name="genre" value="都市" required /></label>
          <label>状态<select name="status"><option>上新</option><option>热播</option><option>完结</option><option>下架</option></select></label>
          <label>评分<input name="rating" type="number" step="0.1" value="8.6" /></label>
          <label>集数<input name="episodes" type="number" value="24" /></label>
          <label>定价<input name="price" type="number" value="19" /></label>
          <label>封面 URL<input name="cover" value="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80" /></label>
          <label>标签<input name="tags" value="短剧,新作,会员" /></label>
          <label>简介<textarea name="synopsis">一部节奏紧凑、适合移动端观看的新短剧。</textarea></label>
          <button class="primary-btn">保存</button>
        </form>
      </section>
    </div>
  `;
}

function adminOrders() {
  return `
    <div class="admin-grid">
      <section class="admin-panel">
        <h2>订单</h2>
        <table>
          <thead><tr><th>订单</th><th>用户</th><th>短剧</th><th>金额</th><th>日期</th></tr></thead>
          <tbody>${state.orders.map((order) => `<tr><td>${order.id}</td><td>${order.user?.name || "-"}</td><td>${order.drama?.title || "-"}</td><td>${money(order.amount)}</td><td>${order.createdAt}</td></tr>`).join("")}</tbody>
        </table>
      </section>
      <section class="admin-panel">
        <h2>用户</h2>
        <table>
          <thead><tr><th>用户</th><th>角色</th><th>套餐</th></tr></thead>
          <tbody>${state.users.map((user) => `<tr><td>${user.name}</td><td>${user.role}</td><td>${user.plan}</td></tr>`).join("")}</tbody>
        </table>
      </section>
    </div>
  `;
}

async function render() {
  if (!state.dramas.length) await loadDramas();
  if (state.user) {
    await loadHistory();
  }
  if (state.route === "admin" && state.user?.role === "admin") {
    await loadAdmin();
    if (state.adminTab === "dramas") await loadAdminDramas(state.adminDramaStatus);
  }
  if (state.route === "rankings") await loadRankings(state.rankTab, state.rankStatus);
  if (state.route === "favorites") await loadFavorites();
  if (state.route === "history") await loadHistory();
  app.innerHTML = `<div class="app-shell">${view()}</div>`;
  bind();
}

function view() {
  if (state.route === "login") return login();
  if (state.route === "detail") return detail();
  if (state.route === "rankings") return rankings();
  if (state.route === "history") return history();
  if (state.route === "favorites") return favorites();
  if (state.route === "admin") return admin();
  return home();
}

function bind() {
  document.querySelectorAll("[data-route]").forEach((node) => {
    node.addEventListener("click", () => route(node.dataset.route));
  });
  document.querySelectorAll("[data-featured-detail]").forEach((node) => {
    node.addEventListener("click", () => route("detail", state.selectedDrama || state.dramas[0]));
  });
  document.querySelectorAll("[data-filter]").forEach((node) => {
    node.addEventListener("click", () => {
      state.filter = node.dataset.filter;
      render();
    });
  });
  document.querySelectorAll("[data-detail]").forEach((node) => {
    node.addEventListener("click", async () => {
      const drama = state.dramas.find((item) => item.id === node.dataset.detail);
      const ep = Number(node.dataset.episode) || 1;
      state.currentEpisode = ep;
      if (state.user && drama) {
        const progress = Math.min(Math.round((ep / (drama.episodes || 1)) * 100), 100);
        await addToHistory(drama.id, ep, progress);
      }
      route("detail", drama);
    });
  });

  document.querySelectorAll("[data-episode]").forEach((node) => {
    if (node.closest(".episode-grid")) {
      node.addEventListener("click", async () => {
        const ep = Number(node.dataset.episode);
        state.currentEpisode = ep;
        const drama = state.selectedDrama || state.dramas[0];
        if (state.user && drama) {
          const progress = Math.min(Math.round((ep / (drama.episodes || 1)) * 100), 100);
          await addToHistory(drama.id, ep, progress);
        }
        render();
      });
    }
  });

  document.querySelectorAll("[data-continue-last]").forEach((node) => {
    node.addEventListener("click", async () => {
      const ep = Number(node.dataset.continueLast) || 1;
      state.currentEpisode = ep;
      const drama = state.selectedDrama || state.dramas[0];
      if (state.user && drama) {
        const progress = Math.min(Math.round((ep / (drama.episodes || 1)) * 100), 100);
        await addToHistory(drama.id, ep, progress);
      }
      render();
    });
  });

  document.querySelectorAll("[data-remove-history]").forEach((node) => {
    node.addEventListener("click", async (e) => {
      e.stopPropagation();
      const dramaId = node.dataset.removeHistory;
      await removeFromHistory(dramaId);
      toast("已删除观看记录");
      render();
    });
  });

  document.querySelector("[data-clear-history]")?.addEventListener("click", async () => {
    if (confirm("确定要清空所有观看历史吗？此操作不可恢复。")) {
      await clearAllHistory();
      toast("已清空观看历史");
      render();
    }
  });

  document.querySelectorAll(".recent-card").forEach((node) => {
    node.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
    });
  });
  document.querySelectorAll("[data-fav]").forEach((node) => {
    node.addEventListener("click", async () => {
      if (!state.user) return route("login");
      const data = await api("/api/favorites", { method: "POST", body: JSON.stringify({ dramaId: node.dataset.fav }) });
      state.user.favorites = data.favorites;
      localStorage.setItem("user", JSON.stringify(state.user));
      toast("收藏状态已更新");
      render();
    });
  });
  document.querySelector("[data-logout]")?.addEventListener("click", logout);
  document.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await api("/api/login", { method: "POST", body: JSON.stringify(body) });
      setSession(data.token, data.user);
      route(data.user.role === "admin" ? "admin" : "home");
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-admin-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      state.adminTab = node.dataset.adminTab;
      render();
    });
  });

  document.querySelectorAll("[data-admin-status]").forEach((node) => {
    node.addEventListener("click", () => {
      state.adminDramaStatus = node.dataset.adminStatus;
      render();
    });
  });

  document.querySelectorAll("[data-rank-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      state.rankTab = node.dataset.rankTab;
      render();
    });
  });

  document.querySelectorAll("[data-rank-status]").forEach((node) => {
    node.addEventListener("click", () => {
      state.rankStatus = node.dataset.rankStatus;
      render();
    });
  });

  document.querySelectorAll(".ranking-card").forEach((node) => {
    node.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      const drama = state.dramas.find((item) => item.id === node.dataset.detail);
      if (drama) route("detail", drama);
    });
  });
  document.querySelector("[data-create-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api("/api/admin/dramas", { method: "POST", body: JSON.stringify(body) });
      await loadDramas();
      if (state.adminTab === "dramas") await loadAdminDramas(state.adminDramaStatus);
      toast("短剧已新增");
      render();
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-offline]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await api(`/api/admin/dramas/${node.dataset.offline}`, {
          method: "PUT",
          body: JSON.stringify({ status: "下架" })
        });
        await loadDramas();
        if (state.adminTab === "dramas") await loadAdminDramas(state.adminDramaStatus);
        toast("短剧已下架");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll("[data-restore]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await api(`/api/admin/dramas/${node.dataset.restore}`, {
          method: "PUT",
          body: JSON.stringify({ status: "上新" })
        });
        await loadDramas();
        if (state.adminTab === "dramas") await loadAdminDramas(state.adminDramaStatus);
        toast("短剧已上架");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll("[data-delete]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await api(`/api/admin/dramas/${node.dataset.delete}`, { method: "DELETE" });
        await loadDramas();
        if (state.adminTab === "dramas") await loadAdminDramas(state.adminDramaStatus);
        toast("短剧已删除");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

async function validateSession() {
  if (!state.token) return;
  try {
    const res = await fetch("/api/me", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`
      }
    });
    if (res.status === 401) {
      clearSession();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      clearSession();
      return;
    }
    setSession(state.token, data.user);
  } catch (error) {
    clearSession();
  }
}

(async function bootstrap() {
  await validateSession();
  try {
    await render();
  } catch (error) {
    app.innerHTML = `<main class="section"><section class="detail-panel"><h2>加载失败</h2><p>${error.message}</p></section></main>`;
  }
})();
