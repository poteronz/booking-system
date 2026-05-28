const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

// GET /api/profile
router.get("/", async (req, res) => {
  const user = await db.getAsync("SELECT id, username, role, created_at FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  const stats = await db.getAsync(`
    SELECT
      COUNT(CASE WHEN status='active' THEN 1 END) as active,
      COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled,
      COUNT(*) as total
    FROM bookings WHERE user_id = ?
  `, [req.user.id]);

  const totalSpent = await db.getAsync(`
    SELECT COALESCE(SUM(s.price), 0) as amount
    FROM bookings b JOIN services s ON b.service_id = s.id
    WHERE b.user_id = ? AND b.status = 'active'
  `, [req.user.id]);

  res.json({ user, stats: { ...stats, total_spent: totalSpent?.amount || 0 } });
});

// PUT /api/profile/password
router.put("/password", async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: "Текущий и новый пароли обязательны" });
  if (new_password.length < 4) return res.status(400).json({ error: "Новый пароль не менее 4 символов" });

  const user = await db.getAsync("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return res.status(400).json({ error: "Неверный текущий пароль" });

  const hash = await bcrypt.hash(new_password, 10);
  await db.runAsync("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
  console.log(`[LOG] ${req.user.username} сменил пароль`);
  res.json({ message: "Пароль изменён" });
});

module.exports = router;
