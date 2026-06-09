const express = require("express");
const db = require("../db");
const { adminRequired } = require("../middleware/auth");

const router = express.Router();
router.use(adminRequired);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  const users = await db.getAsync("SELECT COUNT(*) as count FROM users");
  const services = await db.getAsync("SELECT COUNT(*) as count FROM services WHERE active = 1");
  const bookings = await db.getAsync(`
    SELECT COUNT(*) as total,
      COUNT(CASE WHEN status='active' THEN 1 END) as active,
      COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled
    FROM bookings
  `);
  const revenue = await db.getAsync(`
    SELECT COALESCE(SUM(s.price), 0) as total
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.status = 'active'
  `);
  const popular = await db.allAsync(`
    SELECT s.name, COUNT(b.id) as count
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.status = 'active'
    GROUP BY s.id
    ORDER BY count DESC
    LIMIT 5
  `);

  res.json({
    users: users?.count || 0,
    services: services?.count || 0,
    bookings: {
      total: bookings?.total || 0,
      active: bookings?.active || 0,
      cancelled: bookings?.cancelled || 0,
    },
    revenue: revenue?.total || 0,
    popular_services: popular,
  });
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
  const offset = (page - 1) * limit;

  const whereClauses = [];
  const params = [];

  if (search) {
    whereClauses.push("(u.username LIKE ? OR u.timezone LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (role && role !== "all") {
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Некорректная роль для фильтра" });
    }

    whereClauses.push("u.role = ?");
    params.push(role);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalRow = await db.getAsync(
    `SELECT COUNT(*) as total FROM users u ${whereSql}`,
    params
  );

  const users = await db.allAsync(
    `
      SELECT
        u.id,
        u.username,
        u.role,
        u.timezone,
        u.created_at,
        (
          SELECT COUNT(*)
          FROM bookings
          WHERE user_id = u.id AND status = 'active'
        ) as active_bookings,
        (
          SELECT COUNT(*)
          FROM bookings
          WHERE user_id = u.id
        ) as total_bookings
      FROM users u
      ${whereSql}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const total = totalRow?.total || 0;
  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

module.exports = router;
