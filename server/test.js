const assert = require("assert");
const { readDb } = require("./store");

const db = readDb();
assert.ok(db.users.some((user) => user.username === "admin" && user.role === "admin"), "admin account should exist");
assert.ok(db.users.some((user) => user.username === "viewer" && user.role === "user"), "viewer account should exist");
assert.ok(db.dramas.length >= 4, "seed dramas should exist");
assert.ok(db.dramas.every((drama) => drama.title && drama.cover && Number.isFinite(drama.rating)), "dramas need core fields");

console.log("All smoke tests passed.");
