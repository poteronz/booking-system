const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { generateToken, authRequired } = require("../middleware/auth");

const router = express.Router();

// POST /api/register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Логин и пароль обязательны" });
    if (username.length < 3) return res.status(400).json({ error: "Логин не менее 3 символов" });
    if (password.length < 4) return res.status(400).json({ error: "Пароль не менее 4 символов" });

    // Sanitize
    const clean = username.replace(/[<>"'&]/g, "").trim();

    const existing = await db.getAsync("SELECT id FROM users WHERE username = ?", [clean]);
    if (existing) return res.status(409).json({ error: "Пользователь с таким логином уже существует" });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.runAsync(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)", [clean, hash]
    );

    const user = { id: result.lastID, username: clean, role: "user" };
    const token = generateToken(user);

    res.cookie("token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "strict" });
    res.status(201).json({ message: "Регистрация успешна", user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Логин и пароль обязательны" });

    const user = await db.getAsync("SELECT * FROM users WHERE username = ?", [username.trim()]);
    if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Неверный логин или пароль" });

    const token = generateToken(user);
    res.cookie("token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "strict" });
    res.json({ message: "Вход выполнен", user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Выход выполнен" });
});

// GET /api/me
router.get("/me", authRequired, async (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

module.exports = router;
