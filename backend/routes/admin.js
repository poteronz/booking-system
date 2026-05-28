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
    FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.status = 'active'
  `);
  const popular = await db.allAsync(`
    SELECT s.name, COUNT(b.id) as count FROM bookings b
    JOIN services s ON b.service_id = s.id WHERE b.status = 'active'
    GROUP BY s.id ORDER BY count DESC LIMIT 5
  `);

  res.json({
    users: users?.count || 0,
    services: services?.count || 0,
    bookings: { total: bookings?.total || 0, active: bookings?.active || 0, cancelled: bookings?.cancelled || 0 },
    revenue: revenue?.total || 0,
    popular_services: popular,
  });
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  const users = await db.allAsync(`
    SELECT u.id, u.username, u.role, u.created_at,
      (SELECT COUNT(*) FROM bookings WHERE user_id = u.id AND status = 'active') as active_bookings
    FROM users u ORDER BY u.created_at DESC
  `);
  res.json({ users });
});

module.exports = router;
