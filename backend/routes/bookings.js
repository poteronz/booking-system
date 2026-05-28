const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware/auth");

const router = express.Router();

// POST /api/bookings — создать запись
router.post("/", authRequired, async (req, res) => {
  const { service_id, booking_date, booking_time } = req.body;

  // Валидация полей
  if (!service_id || !booking_date || !booking_time) {
    return res.status(400).json({ error: "Услуга, дата и время обязательны" });
  }

  // Проверить что услуга существует и активна
  const service = await db.getAsync("SELECT * FROM services WHERE id = ? AND active = 1", [service_id]);
  if (!service) return res.status(404).json({ error: "Услуга не найдена или неактивна" });

  // Проверить что дата не в прошлом
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);

  if (booking_date < today) {
    return res.status(400).json({ error: "Нельзя записаться на прошедшую дату" });
  }

  // Если дата сегодня — проверить что время ещё не прошло
  if (booking_date === today && booking_time <= currentTime) {
    return res.status(400).json({ error: "Это время уже прошло. Выберите более позднее" });
  }

  // Проверить что формат времени валидный
  const validTimes = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
  if (!validTimes.includes(booking_time)) {
    return res.status(400).json({ error: "Некорректное время записи" });
  }

  // Проверить что слот свободен
  const conflict = await db.getAsync(
    "SELECT id FROM bookings WHERE service_id = ? AND booking_date = ? AND booking_time = ? AND status = 'active'",
    [service_id, booking_date, booking_time]
  );
  if (conflict) return res.status(409).json({ error: "Это время уже занято. Выберите другое" });

  // Проверить что пользователь не записан на это же время (любая услуга)
  const userConflict = await db.getAsync(
    "SELECT id FROM bookings WHERE user_id = ? AND booking_date = ? AND booking_time = ? AND status = 'active'",
    [req.user.id, booking_date, booking_time]
  );
  if (userConflict) return res.status(409).json({ error: "У вас уже есть запись на это время" });

  // Создать запись
  const result = await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?, ?, ?, ?)",
    [req.user.id, service_id, booking_date, booking_time]
  );

  const booking = await db.getAsync(`
    SELECT b.*, s.name as service_name, s.price as service_price, s.duration as service_duration
    FROM bookings b JOIN services s ON b.service_id = s.id
    WHERE b.id = ?
  `, [result.lastID]);

  console.log(`[LOG] ${req.user.username} записался на "${service.name}" — ${booking_date} ${booking_time}`);
  res.status(201).json({ booking, message: "Запись успешно создана!" });
});

// GET /api/bookings/my — мои записи
router.get("/my", authRequired, async (req, res) => {
  const bookings = await db.allAsync(`
    SELECT b.*, s.name as service_name, s.description as service_desc,
           s.price as service_price, s.duration as service_duration
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.user_id = ?
    ORDER BY
      CASE WHEN b.status = 'active' THEN 0 ELSE 1 END,
      b.booking_date ASC, b.booking_time ASC
  `, [req.user.id]);
  res.json({ bookings });
});

// DELETE /api/bookings/:id — отменить запись (только свою!)
router.delete("/:id", authRequired, async (req, res) => {
  const booking = await db.getAsync(
    "SELECT b.*, s.name as service_name FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.id = ?",
    [req.params.id]
  );

  if (!booking) return res.status(404).json({ error: "Запись не найдена" });

  // Критичная проверка: пользователь отменяет ТОЛЬКО свою запись
  if (booking.user_id !== req.user.id) {
    console.log(`[SECURITY] ${req.user.username} пытался отменить чужую запись #${req.params.id}`);
    return res.status(403).json({ error: "Нельзя отменить чужую запись" });
  }

  if (booking.status !== "active") {
    return res.status(400).json({ error: "Можно отменить только активные записи" });
  }

  await db.runAsync("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);
  console.log(`[LOG] ${req.user.username} отменил запись на "${booking.service_name}" — ${booking.booking_date} ${booking.booking_time}`);
  res.json({ message: "Запись успешно отменена" });
});

// GET /api/bookings/admin/all — все записи (только админ)
router.get("/admin/all", adminRequired, async (req, res) => {
  const bookings = await db.allAsync(`
    SELECT b.*, s.name as service_name, s.price as service_price,
           s.duration as service_duration, u.username as user_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN users u ON b.user_id = u.id
    ORDER BY
      CASE WHEN b.status = 'active' THEN 0 ELSE 1 END,
      b.booking_date ASC, b.booking_time ASC
  `);

  // Статистика для админа
  const stats = {
    total: bookings.length,
    active: bookings.filter(b => b.status === "active").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };

  res.json({ bookings, stats });
});

// GET /api/bookings/busy-times — занятые слоты для даты+услуги
router.get("/busy-times", async (req, res) => {
  const { service_id, date } = req.query;
  if (!service_id || !date) return res.status(400).json({ error: "service_id и date обязательны" });

  const busy = await db.allAsync(
    "SELECT booking_time FROM bookings WHERE service_id = ? AND booking_date = ? AND status = 'active'",
    [service_id, date]
  );
  res.json({ busy_times: busy.map(b => b.booking_time) });
});

module.exports = router;
