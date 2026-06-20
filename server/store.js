const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const dbFile = path.join(dataDir, "db.json");

const seed = {
  users: [
    {
      id: "u_admin",
      username: "admin",
      password: "admin123",
      role: "admin",
      name: "平台管理员",
      plan: "运营版",
      favorites: [],
      watchHistory: []
    },
    {
      id: "u_demo",
      username: "viewer",
      password: "viewer123",
      role: "user",
      name: "追剧用户",
      plan: "黄金会员",
      favorites: ["d1", "d4"],
      watchHistory: [
        { dramaId: "d1", episode: 5, watchedAt: "2026-06-18T20:30:00.000Z", progress: 45 },
        { dramaId: "d3", episode: 12, watchedAt: "2026-06-17T15:20:00.000Z", progress: 80 },
        { dramaId: "d2", episode: 1, watchedAt: "2026-06-15T22:10:00.000Z", progress: 15 }
      ]
    }
  ],
  dramas: [
    {
      id: "d1",
      title: "逆光而来的她",
      genre: "都市",
      status: "热播",
      rating: 9.2,
      episodes: 38,
      price: 29,
      views: 1283000,
      cover: "https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b?auto=format&fit=crop&w=900&q=80",
      synopsis: "失意制片人重回旧城，与神秘女主角共同揭开一段被剪掉的真相。",
      tags: ["女性成长", "悬疑", "精品短剧"]
    },
    {
      id: "d2",
      title: "总裁的第七次心动",
      genre: "甜宠",
      status: "完结",
      rating: 8.8,
      episodes: 52,
      price: 19,
      views: 903000,
      cover: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
      synopsis: "合约关系从互相试探到双向奔赴，一场误会牵出两代人的秘密。",
      tags: ["甜宠", "反转", "高能"]
    },
    {
      id: "d3",
      title: "风起长宁",
      genre: "古装",
      status: "热播",
      rating: 9.5,
      episodes: 45,
      price: 39,
      views: 1760000,
      cover: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=900&q=80",
      synopsis: "少年将军与女谋士联手破局，在朝堂与江湖之间寻找真正的秩序。",
      tags: ["权谋", "古风", "强剧情"]
    },
    {
      id: "d4",
      title: "凌晨三点的便利店",
      genre: "治愈",
      status: "上新",
      rating: 8.9,
      episodes: 24,
      price: 12,
      views: 421000,
      cover: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
      synopsis: "夜班店员记录每个陌生人的深夜故事，也慢慢修复自己的生活。",
      tags: ["治愈", "单元剧", "现实"]
    }
  ],
  orders: [
    { id: "o1", userId: "u_demo", dramaId: "d1", amount: 29, status: "paid", createdAt: "2026-06-01" },
    { id: "o2", userId: "u_demo", dramaId: "d4", amount: 12, status: "paid", createdAt: "2026-06-08" }
  ]
};

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(seed, null, 2));
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

module.exports = {
  readDb,
  writeDb,
  publicUser,
  createId
};
