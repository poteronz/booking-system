const express = require("express");
const db = require("../db");
const { adminRequired } = require("../middleware/auth");

const router = express.Router();

// GET /api/services — список услуг с поиском и сортировкой
router.get("/", async (req, res) => {
  const { search, sort } = req.query;
  let query = "SELECT * FROM services WHERE active = 1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  switch (sort) {
    case "price_asc": query += " ORDER BY price ASC"; break;
    case "price_desc": query += " ORDER BY price DESC"; break;
    case "duration": query += " ORDER BY duration ASC"; break;
    case "name": query += " ORDER BY name ASC"; break;
    default: query += " ORDER BY id ASC";
  }

  const services = await db.allAsync(query, params);
  res.json({ services });
});

// GET /api/services/:id
router.get("/:id", async (req, res) => {
  const service = await db.getAsync("SELECT * FROM services WHERE id = ? AND active = 1", [req.params.id]);
  if (!service) return res.status(404).json({ error: "Услуга не найдена" });

  // Count active bookings for this service
  const stats = await db.getAsync(
    "SELECT COUNT(*) as booking_count FROM bookings WHERE service_id = ? AND status = 'active'",
    [req.params.id]
  );
  service.booking_count = stats?.booking_count || 0;

  res.json({ service });
});

// POST /api/admin/services — добавить
router.post("/", adminRequired, async (req, res) => {
  const { name, description, price, duration } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: "Название обязательно (мин. 2 символа)" });

  const cleanName = name.replace(/[<>"'&]/g, "").trim();
  const cleanDesc = (description || "").replace(/[<>"'&]/g, "").trim();
  const cleanPrice = Math.max(0, parseInt(price) || 0);
  const cleanDuration = Math.max(15, parseInt(duration) || 60);

  const result = await db.runAsync(
    "INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)",
    [cleanName, cleanDesc, cleanPrice, cleanDuration]
  );

  const service = await db.getAsync("SELECT * FROM services WHERE id = ?", [result.lastID]);
  console.log(`[LOG] Админ добавил услугу: "${cleanName}" (id=${result.lastID})`);
  res.status(201).json({ service, message: "Услуга добавлена" });
});

// DELETE /api/admin/services/:id — удалить
router.delete("/:id", adminRequired, async (req, res) => {
  const service = await db.getAsync("SELECT * FROM services WHERE id = ?", [req.params.id]);
  if (!service) return res.status(404).json({ error: "Услуга не найдена" });

  await db.runAsync("UPDATE services SET active = 0 WHERE id = ?", [req.params.id]);
  console.log(`[LOG] Админ удалил услугу: "${service.name}" (id=${req.params.id})`);
  res.json({ message: "Услуга удалена" });
});

module.exports = router;
