const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { authRequired, generateToken } = require("../middleware/auth");
const { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } = require("../lib/time");

const router = express.Router();
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "strict",
  path: "/",
};

function normalizeUsername(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[<>"'&]/g, "").trim();
}

async function loadProfileUser(userId) {
  return db.getAsync(
    "SELECT id, username, role, timezone, created_at FROM users WHERE id = ?",
    [userId]
  );
}

router.use(authRequired);

// GET /api/profile
router.get("/", async (req, res) => {
  const user = await loadProfileUser(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  const stats = await db.getAsync(
    `
      SELECT
        COUNT(CASE WHEN status='active' THEN 1 END) as active,
        COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled,
        COUNT(*) as total
      FROM bookings WHERE user_id = ?
    `,
    [req.user.id]
  );

  const totalSpent = await db.getAsync(
    `
      SELECT COALESCE(SUM(s.price), 0) as amount
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ? AND b.status = 'active'
    `,
    [req.user.id]
  );

  res.json({
    user: {
      ...user,
      timezone: user.timezone || DEFAULT_TIME_ZONE,
    },
    stats: {
      active: stats?.active || 0,
      cancelled: stats?.cancelled || 0,
      total: stats?.total || 0,
      total_spent: totalSpent?.amount || 0,
    },
  });
});

// PUT /api/profile
router.put("/", async (req, res) => {
  const incomingUsername = normalizeUsername(req.body.username);
  const requestedTimezone = typeof req.body.timezone === "string" ? req.body.timezone.trim() : "";
  const incomingTimezone = requestedTimezone ? requestedTimezone : null;

  if (!incomingUsername && !incomingTimezone) {
    return res.status(400).json({ error: "Передайте новые данные для профиля" });
  }

  if (incomingUsername && incomingUsername.length < 3) {
    return res.status(400).json({ error: "Логин не менее 3 символов" });
  }

  if (incomingTimezone && !isValidTimeZone(incomingTimezone)) {
    return res.status(400).json({ error: "Некорректный timezone" });
  }

  const currentUser = await loadProfileUser(req.user.id);
  if (!currentUser) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  const nextUsername = incomingUsername || currentUser.username;
  const nextTimezone = incomingTimezone ? resolveTimeZone(incomingTimezone) : currentUser.timezone || DEFAULT_TIME_ZONE;

  if (nextUsername !== currentUser.username) {
    const duplicate = await db.getAsync(
      "SELECT id FROM users WHERE username = ? AND id != ?",
      [nextUsername, req.user.id]
    );
    if (duplicate) {
      return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
    }
  }

  await db.runAsync(
    "UPDATE users SET username = ?, timezone = ? WHERE id = ?",
    [nextUsername, nextTimezone, req.user.id]
  );

  const updatedUser = await loadProfileUser(req.user.id);
  const token = generateToken(updatedUser);
  res.cookie("token", token, AUTH_COOKIE_OPTIONS);

  console.log(`[LOG] ${currentUser.username} обновил профиль`);
  res.json({
    message: "Профиль обновлён",
    user: {
      ...updatedUser,
      timezone: updatedUser.timezone || DEFAULT_TIME_ZONE,
    },
    token,
  });
});

// PUT /api/profile/password
router.put("/password", async (req, res) => {
  const currentPassword = typeof req.body.current_password === "string" ? req.body.current_password : "";
  const newPassword = typeof req.body.new_password === "string" ? req.body.new_password : "";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Текущий и новый пароли обязательны" });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: "Новый пароль не менее 4 символов" });
  }

  const user = await db.getAsync("SELECT id, username, password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(400).json({ error: "Неверный текущий пароль" });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.runAsync("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
  console.log(`[LOG] ${user.username} сменил пароль`);

  res.json({ message: "Пароль изменён" });
});

module.exports = router;
