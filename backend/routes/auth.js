const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { generateToken, authRequired } = require("../middleware/auth");
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

async function loadUserById(userId) {
  return db.getAsync(
    "SELECT id, username, role, timezone, created_at FROM users WHERE id = ?",
    [userId]
  );
}

// POST /api/register
router.post("/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const requestedTimezone = typeof req.body.timezone === "string" ? req.body.timezone.trim() : "";
    if (requestedTimezone && !isValidTimeZone(requestedTimezone)) {
      return res.status(400).json({ error: "Некорректный timezone" });
    }

    const timezone = requestedTimezone ? resolveTimeZone(requestedTimezone) : DEFAULT_TIME_ZONE;

    if (!username || !password) {
      return res.status(400).json({ error: "Логин и пароль обязательны" });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Логин не менее 3 символов" });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "Пароль не менее 4 символов" });
    }

    const existing = await db.getAsync("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) {
      return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.runAsync(
      "INSERT INTO users (username, password_hash, timezone) VALUES (?, ?, ?)",
      [username, hash, timezone]
    );

    const user = {
      id: result.lastID,
      username,
      role: "user",
      timezone,
    };
    const token = generateToken(user);

    res.cookie("token", token, AUTH_COOKIE_OPTIONS);
    res.status(201).json({
      message: "Регистрация успешна",
      user,
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "Логин и пароль обязательны" });
    }

    const user = await db.getAsync(
      "SELECT id, username, password_hash, role, timezone FROM users WHERE username = ?",
      [username]
    );
    if (!user) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const token = generateToken(user);
    res.cookie("token", token, AUTH_COOKIE_OPTIONS);
    res.json({
      message: "Вход выполнен",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        timezone: user.timezone || DEFAULT_TIME_ZONE,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Выход выполнен" });
});

// GET /api/me
router.get("/me", authRequired, async (req, res) => {
  const user = await loadUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      timezone: user.timezone || DEFAULT_TIME_ZONE,
      created_at: user.created_at,
    },
  });
});

module.exports = router;
