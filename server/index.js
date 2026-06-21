const http = require("http");
const path = require("path");
const fs = require("fs");
const { readDb, writeDb, publicUser, createId } = require("./store");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "..", "public");
const sessions = new Map();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    ...headers
  });
  res.end(payload);
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function currentUser(req) {
  const token = getToken(req);
  const session = sessions.get(token);
  if (!session) return null;
  const db = readDb();
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) send(res, 401, { message: "请先登录" });
  return user;
}

function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    send(res, 403, { message: "需要管理员权限" });
    return null;
  }
  return user;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function enrichDrama(db, drama) {
  const revenue = db.orders
    .filter((order) => order.dramaId === drama.id && order.status === "paid")
    .reduce((sum, order) => sum + order.amount, 0);
  return { ...drama, revenue };
}

function validateDramaCreate(body) {
  const errors = [];

  const title = String(body.title || "").trim();
  if (!title) {
    errors.push("短剧名称不能为空");
  } else if (title.length > 100) {
    errors.push("短剧名称不能超过 100 个字符");
  }

  if (body.rating !== undefined && body.rating !== "") {
    const rating = Number(body.rating);
    if (isNaN(rating) || rating < 0 || rating > 10) {
      errors.push("评分必须在 0 到 10 之间");
    }
  }

  if (body.episodes !== undefined && body.episodes !== "") {
    const episodes = Number(body.episodes);
    if (isNaN(episodes) || !Number.isInteger(episodes) || episodes < 1 || episodes > 999) {
      errors.push("集数必须是 1 到 999 之间的整数");
    }
  }

  if (body.price !== undefined && body.price !== "") {
    const price = Number(body.price);
    if (isNaN(price) || price < 0) {
      errors.push("定价不能为负数");
    }
  }

  const cover = String(body.cover || "").trim();
  if (!cover) {
    errors.push("封面 URL 不能为空");
  } else if (!/^https?:\/\/.+/.test(cover)) {
    errors.push("封面 URL 格式不正确");
  }

  if (body.synopsis !== undefined) {
    const synopsis = String(body.synopsis || "").trim();
    if (synopsis.length > 500) {
      errors.push("简介不能超过 500 个字符");
    }
  }

  return errors;
}

function validateDramaUpdate(body) {
  const errors = [];
  const keys = Object.keys(body);

  if (keys.includes("title")) {
    const title = String(body.title || "").trim();
    if (!title) {
      errors.push("短剧名称不能为空");
    } else if (title.length > 100) {
      errors.push("短剧名称不能超过 100 个字符");
    }
  }

  if (keys.includes("rating")) {
    const rating = Number(body.rating);
    if (body.rating === "" || isNaN(rating) || rating < 0 || rating > 10) {
      errors.push("评分必须在 0 到 10 之间");
    }
  }

  if (keys.includes("episodes")) {
    const episodes = Number(body.episodes);
    if (body.episodes === "" || isNaN(episodes) || !Number.isInteger(episodes) || episodes < 1 || episodes > 999) {
      errors.push("集数必须是 1 到 999 之间的整数");
    }
  }

  if (keys.includes("price")) {
    const price = Number(body.price);
    if (body.price === "" || isNaN(price) || price < 0) {
      errors.push("定价不能为负数");
    }
  }

  if (keys.includes("cover")) {
    const cover = String(body.cover || "").trim();
    if (!cover) {
      errors.push("封面 URL 不能为空");
    } else if (!/^https?:\/\/.+/.test(cover)) {
      errors.push("封面 URL 格式不正确");
    }
  }

  if (keys.includes("synopsis")) {
    const synopsis = String(body.synopsis || "").trim();
    if (synopsis.length > 500) {
      errors.push("简介不能超过 500 个字符");
    }
  }

  return errors;
}

async function api(req, res, pathname, url) {
  const db = readDb();

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.username === body.username && item.password === body.password);
    if (!user) return send(res, 401, { message: "账号或密码错误" });
    const token = createId("token");
    sessions.set(token, { userId: user.id, createdAt: Date.now() });
    return send(res, 200, { token, user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const user = requireUser(req, res);
    if (!user) return;
    return send(res, 200, { user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/dramas") {
    const visibleDramas = db.dramas.filter((drama) => drama.status !== "下架");
    return send(res, 200, { dramas: visibleDramas.map((drama) => enrichDrama(db, drama)) });
  }

  if (req.method === "GET" && pathname === "/api/rankings") {
    const type = url.searchParams.get("type") || "views";
    const status = url.searchParams.get("status") || "";
    let list = db.dramas
      .filter((drama) => drama.status !== "下架")
      .map((drama) => enrichDrama(db, drama));
    if (status) list = list.filter((drama) => drama.status === status);
    if (type === "views") list.sort((a, b) => b.views - a.views);
    else if (type === "rating") list.sort((a, b) => b.rating - a.rating);
    else if (type === "revenue") list.sort((a, b) => b.revenue - a.revenue);
    return send(res, 200, { rankings: list.slice(0, 10) });
  }

  if (req.method === "GET" && pathname.startsWith("/api/dramas/")) {
    const id = decodeURIComponent(pathname.split("/").pop());
    const drama = db.dramas.find((item) => item.id === id);
    if (!drama) return send(res, 404, { message: "短剧不存在" });
    if (drama.status === "下架") return send(res, 404, { message: "短剧不存在" });
    return send(res, 200, { drama: enrichDrama(db, drama) });
  }

  if (req.method === "GET" && pathname === "/api/favorites") {
    const user = requireUser(req, res);
    if (!user) return;
    const stored = db.users.find((item) => item.id === user.id);
    const favoriteIds = stored.favorites || [];
    const dramas = db.dramas
      .filter((drama) => favoriteIds.includes(drama.id) && drama.status !== "下架")
      .map((drama) => enrichDrama(db, drama))
      .sort((a, b) => favoriteIds.indexOf(b.id) - favoriteIds.indexOf(a.id));
    return send(res, 200, { dramas });
  }

  if (req.method === "POST" && pathname === "/api/favorites") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    const drama = db.dramas.find((item) => item.id === body.dramaId);
    if (!drama) return send(res, 404, { message: "短剧不存在" });
    const stored = db.users.find((item) => item.id === user.id);
    stored.favorites = stored.favorites || [];
    if (stored.favorites.includes(drama.id)) {
      stored.favorites = stored.favorites.filter((id) => id !== drama.id);
    } else {
      stored.favorites.push(drama.id);
    }
    writeDb(db);
    return send(res, 200, { favorites: stored.favorites });
  }

  if (req.method === "GET" && pathname === "/api/history") {
    const user = requireUser(req, res);
    if (!user) return;
    const stored = db.users.find((item) => item.id === user.id);
    const history = (stored.watchHistory || []).slice().sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
    const dramas = history.map((record) => {
      const drama = db.dramas.find((d) => d.id === record.dramaId);
      if (!drama || drama.status === "下架") return null;
      return {
        ...enrichDrama(db, drama),
        episode: record.episode,
        watchedAt: record.watchedAt,
        progress: record.progress || 0
      };
    }).filter(Boolean);
    return send(res, 200, { history: dramas });
  }

  if (req.method === "POST" && pathname === "/api/history") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    const drama = db.dramas.find((item) => item.id === body.dramaId);
    if (!drama) return send(res, 404, { message: "短剧不存在" });
    const stored = db.users.find((item) => item.id === user.id);
    stored.watchHistory = stored.watchHistory || [];
    const existingIndex = stored.watchHistory.findIndex((r) => r.dramaId === body.dramaId);
    const record = {
      dramaId: body.dramaId,
      episode: Number(body.episode) || 1,
      watchedAt: new Date().toISOString(),
      progress: Number(body.progress) || 0
    };
    if (existingIndex >= 0) {
      stored.watchHistory[existingIndex] = record;
    } else {
      stored.watchHistory.unshift(record);
    }
    if (stored.watchHistory.length > 100) {
      stored.watchHistory = stored.watchHistory.slice(0, 100);
    }
    writeDb(db);
    return send(res, 200, { ok: true, record });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/history/")) {
    const user = requireUser(req, res);
    if (!user) return;
    const dramaId = decodeURIComponent(pathname.split("/").pop());
    const stored = db.users.find((item) => item.id === user.id);
    stored.watchHistory = (stored.watchHistory || []).filter((r) => r.dramaId !== dramaId);
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && pathname === "/api/history") {
    const user = requireUser(req, res);
    if (!user) return;
    const stored = db.users.find((item) => item.id === user.id);
    stored.watchHistory = [];
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin/stats") {
    if (!requireAdmin(req, res)) return;
    const revenue = db.orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.amount, 0);
    return send(res, 200, {
      stats: {
        dramas: db.dramas.length,
        users: db.users.length,
        orders: db.orders.length,
        revenue,
        views: db.dramas.reduce((sum, drama) => sum + drama.views, 0)
      },
      users: db.users.map(publicUser),
      orders: db.orders.map((order) => ({
        ...order,
        user: publicUser(db.users.find((user) => user.id === order.userId)),
        drama: db.dramas.find((drama) => drama.id === order.dramaId)
      }))
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/dramas") {
    if (!requireAdmin(req, res)) return;
    const status = url.searchParams.get("status") || "";
    let list = db.dramas.map((drama) => enrichDrama(db, drama));
    if (status) list = list.filter((drama) => drama.status === status);
    return send(res, 200, { dramas: list });
  }

  if (req.method === "POST" && pathname === "/api/admin/dramas") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    const errors = validateDramaCreate(body);
    if (errors.length) {
      return send(res, 400, { message: errors.join("；") });
    }
    const drama = {
      id: createId("d"),
      title: String(body.title || "未命名短剧"),
      genre: String(body.genre || "其他"),
      status: String(body.status || "上新"),
      rating: Number(body.rating || 8),
      episodes: Number(body.episodes || 12),
      price: Number(body.price || 0),
      views: Number(body.views || 0),
      cover: String(body.cover || "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80"),
      synopsis: String(body.synopsis || ""),
      tags: String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
    };
    db.dramas.unshift(drama);
    writeDb(db);
    return send(res, 201, { drama });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/dramas/")) {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(pathname.split("/").pop());
    const index = db.dramas.findIndex((item) => item.id === id);
    if (index < 0) return send(res, 404, { message: "短剧不存在" });
    const body = await readBody(req);
    const errors = validateDramaUpdate(body);
    if (errors.length) {
      return send(res, 400, { message: errors.join("；") });
    }
    const original = db.dramas[index];
    const keys = Object.keys(body);
    const updated = { ...original };

    if (keys.includes("title")) updated.title = String(body.title);
    if (keys.includes("genre")) updated.genre = String(body.genre);
    if (keys.includes("status")) updated.status = String(body.status);
    if (keys.includes("rating")) updated.rating = Number(body.rating);
    if (keys.includes("episodes")) updated.episodes = Number(body.episodes);
    if (keys.includes("price")) updated.price = Number(body.price);
    if (keys.includes("views")) updated.views = Number(body.views);
    if (keys.includes("cover")) updated.cover = String(body.cover);
    if (keys.includes("synopsis")) updated.synopsis = String(body.synopsis);
    if (keys.includes("tags")) {
      updated.tags = Array.isArray(body.tags)
        ? body.tags
        : String(body.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
    }

    db.dramas[index] = updated;
    writeDb(db);
    return send(res, 200, { drama: db.dramas[index] });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/dramas/")) {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(pathname.split("/").pop());
    const next = db.dramas.filter((item) => item.id !== id);
    if (next.length === db.dramas.length) return send(res, 404, { message: "短剧不存在" });
    db.dramas = next;
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin/revenue-analysis") {
    if (!requireAdmin(req, res)) return;
    const paidOrders = db.orders.filter((order) => order.status === "paid");

    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
    const totalOrders = paidOrders.length;
    const payingUserIds = [...new Set(paidOrders.map((order) => order.userId))];
    const payingUsers = payingUserIds.length;
    const arpu = payingUsers > 0 ? Math.round((totalRevenue / payingUsers) * 100) / 100 : 0;
    const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    const dramaRevenueMap = new Map();
    paidOrders.forEach((order) => {
      if (!dramaRevenueMap.has(order.dramaId)) {
        dramaRevenueMap.set(order.dramaId, { revenue: 0, orders: 0, userIds: new Set() });
      }
      const data = dramaRevenueMap.get(order.dramaId);
      data.revenue += order.amount;
      data.orders += 1;
      data.userIds.add(order.userId);
    });

    const dramaRankings = db.dramas.map((drama) => {
      const data = dramaRevenueMap.get(drama.id) || { revenue: 0, orders: 0, userIds: new Set() };
      const uniqueUsers = data.userIds.size;
      const conversionRate = drama.views > 0 ? Math.round((uniqueUsers / drama.views) * 10000) / 100 : 0;
      return {
        ...drama,
        revenue: data.revenue,
        orders: data.orders,
        payingUsers: uniqueUsers,
        conversionRate
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const genreStats = {};
    dramaRankings.forEach((drama) => {
      if (!genreStats[drama.genre]) {
        genreStats[drama.genre] = { revenue: 0, orders: 0, dramas: 0 };
      }
      genreStats[drama.genre].revenue += drama.revenue;
      genreStats[drama.genre].orders += drama.orders;
      genreStats[drama.genre].dramas += 1;
    });
    const genreDistribution = Object.entries(genreStats)
      .map(([genre, stats]) => ({ genre, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    const userSpendingMap = new Map();
    paidOrders.forEach((order) => {
      if (!userSpendingMap.has(order.userId)) {
        userSpendingMap.set(order.userId, 0);
      }
      userSpendingMap.set(order.userId, userSpendingMap.get(order.userId) + order.amount);
    });

    const spendingTiers = [
      { label: "0-20元", min: 0, max: 20, count: 0, revenue: 0 },
      { label: "20-50元", min: 20, max: 50, count: 0, revenue: 0 },
      { label: "50-100元", min: 50, max: 100, count: 0, revenue: 0 },
      { label: "100元以上", min: 100, max: Infinity, count: 0, revenue: 0 }
    ];

    userSpendingMap.forEach((spending, userId) => {
      const tier = spendingTiers.find((t) => spending >= t.min && spending < t.max);
      if (tier) {
        tier.count += 1;
        tier.revenue += spending;
      }
    });

    const dateStats = {};
    paidOrders.forEach((order) => {
      const date = order.createdAt;
      if (!dateStats[date]) {
        dateStats[date] = { orders: 0, revenue: 0 };
      }
      dateStats[date].orders += 1;
      dateStats[date].revenue += order.amount;
    });
    const dailyOrders = Object.entries(dateStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const highPerformers = dramaRankings.filter((d) => d.revenue > 0 && d.conversionRate > 0.01).slice(0, 5);
    const lowPerformers = dramaRankings.filter((d) => d.views > 1000 && d.revenue === 0).slice(0, 5);

    return send(res, 200, {
      overview: {
        totalRevenue,
        totalOrders,
        payingUsers,
        arpu,
        avgOrderValue
      },
      dramaRankings,
      genreDistribution,
      spendingTiers,
      dailyOrders,
      highPerformers,
      lowPerformers
    });
  }

  send(res, 404, { message: "接口不存在" });
}

function staticFile(req, res, pathname) {
  const filePath = pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, pathname);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(publicDir)) return send(res, 403, "Forbidden");
  fs.readFile(normalized, (error, content) => {
    if (error) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackError, html) => {
        if (fallbackError) return send(res, 404, "Not found");
        res.writeHead(200, { "Content-Type": mime[".html"] });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(normalized)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname, url);
    staticFile(req, res, url.pathname);
  } catch (error) {
    send(res, 500, { message: "服务异常", detail: error.message });
  }
});

server.listen(port, () => {
  console.log(`Short drama platform running at http://localhost:${port}`);
});
