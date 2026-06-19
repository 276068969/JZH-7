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
    return send(res, 200, { dramas: db.dramas.map((drama) => enrichDrama(db, drama)) });
  }

  if (req.method === "GET" && pathname === "/api/rankings") {
    const type = url.searchParams.get("type") || "views";
    const status = url.searchParams.get("status") || "";
    let list = db.dramas.map((drama) => enrichDrama(db, drama));
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
    return send(res, 200, { drama: enrichDrama(db, drama) });
  }

  if (req.method === "GET" && pathname === "/api/favorites") {
    const user = requireUser(req, res);
    if (!user) return;
    const stored = db.users.find((item) => item.id === user.id);
    const favoriteIds = stored.favorites || [];
    const dramas = db.dramas
      .filter((drama) => favoriteIds.includes(drama.id))
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

  if (req.method === "POST" && pathname === "/api/admin/dramas") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
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
    db.dramas[index] = {
      ...db.dramas[index],
      ...body,
      rating: Number(body.rating ?? db.dramas[index].rating),
      episodes: Number(body.episodes ?? db.dramas[index].episodes),
      price: Number(body.price ?? db.dramas[index].price),
      views: Number(body.views ?? db.dramas[index].views),
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
    };
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
