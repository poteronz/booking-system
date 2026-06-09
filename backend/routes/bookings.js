const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware/auth");
const {
  DEFAULT_TIME_ZONE,
  getWeekdayIndexFromDateString,
  isPastDateTime,
  normalizeTimeString,
} = require("../lib/time");

const router = express.Router();

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseServiceId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function rollbackTransaction() {
  try {
    await db.runAsync("ROLLBACK");
  } catch {
    // ignore rollback errors
  }
}

// POST /api/bookings — создать запись
router.post("/", authRequired, async (req, res) => {
  const serviceId = parseServiceId(req.body.service_id);
  const bookingDate = typeof req.body.booking_date === "string" ? req.body.booking_date.trim() : "";
  const bookingTime = normalizeTimeString(req.body.booking_time);
  const dayOfWeek = getWeekdayIndexFromDateString(bookingDate);

  if (!serviceId || !bookingDate || !bookingTime) {
    return res.status(400).json({ error: "Услуга, дата и время обязательны" });
  }

  if (dayOfWeek === null) {
    return res.status(400).json({ error: "Некорректная дата" });
  }

  const service = await db.getAsync("SELECT * FROM services WHERE id = ? AND active = 1", [serviceId]);
  if (!service) {
    return res.status(404).json({ error: "Услуга не найдена или неактивна" });
  }

  if (isPastDateTime(bookingDate, bookingTime, DEFAULT_TIME_ZONE)) {
    return res.status(400).json({ error: "Нельзя записаться на прошедшую дату" });
  }

  await db.runAsync("BEGIN IMMEDIATE TRANSACTION");

  try {
    const slot = await db.getAsync(
      `
        SELECT id, max_bookings
        FROM time_slots
        WHERE service_id = ? AND day_of_week = ? AND slot_time = ? AND is_active = 1
      `,
      [serviceId, dayOfWeek, bookingTime]
    );

    if (!slot) {
      throw createHttpError(
        400,
        "Этот слот недоступен для данной услуги в выбранный день"
      );
    }

    const userConflict = await db.getAsync(
      `
        SELECT id
        FROM bookings
        WHERE user_id = ? AND booking_date = ? AND booking_time = ? AND status = 'active'
      `,
      [req.user.id, bookingDate, bookingTime]
    );

    if (userConflict) {
      throw createHttpError(409, "У вас уже есть запись на это время");
    }

    const bookedCountRow = await db.getAsync(
      `
        SELECT COUNT(*) as count
        FROM bookings
        WHERE service_id = ? AND booking_date = ? AND booking_time = ? AND status = 'active'
      `,
      [serviceId, bookingDate, bookingTime]
    );

    const bookedCount = Number(bookedCountRow?.count || 0);
    const maxBookings = Math.max(1, Number(slot.max_bookings) || 1);

    if (bookedCount >= maxBookings) {
      throw createHttpError(409, "Это время уже занято. Выберите другое");
    }

    const result = await db.runAsync(
      "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?, ?, ?, ?)",
      [req.user.id, serviceId, bookingDate, bookingTime]
    );

    await db.runAsync("COMMIT");

    const booking = await db.getAsync(
      `
        SELECT
          b.*,
          s.name as service_name,
          s.price as service_price,
          s.duration as service_duration
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        WHERE b.id = ?
      `,
      [result.lastID]
    );

    console.log(
      `[LOG] ${req.user.username} записался на "${service.name}" — ${bookingDate} ${bookingTime}`
    );
    return res.status(201).json({ booking, message: "Запись успешно создана!" });
  } catch (error) {
    await rollbackTransaction();

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error("Booking creation error:", error);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/bookings/my — мои записи
router.get("/my", authRequired, async (req, res) => {
  const bookings = await db.allAsync(
    `
      SELECT b.*, s.name as service_name, s.description as service_desc,
             s.price as service_price, s.duration as service_duration
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ?
      ORDER BY
        CASE WHEN b.status = 'active' THEN 0 ELSE 1 END,
        b.booking_date ASC, b.booking_time ASC
    `,
    [req.user.id]
  );
  res.json({ bookings });
});

// DELETE /api/bookings/:id — отменить запись (только свою!)
router.delete("/:id", authRequired, async (req, res) => {
  const booking = await db.getAsync(
    "SELECT b.*, s.name as service_name FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.id = ?",
    [req.params.id]
  );

  if (!booking) {
    return res.status(404).json({ error: "Запись не найдена" });
  }

  if (booking.user_id !== req.user.id) {
    console.log(`[SECURITY] ${req.user.username} пытался отменить чужую запись #${req.params.id}`);
    return res.status(403).json({ error: "Нельзя отменить чужую запись" });
  }

  if (booking.status !== "active") {
    return res.status(400).json({ error: "Можно отменить только активные записи" });
  }

  await db.runAsync("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);
  console.log(
    `[LOG] ${req.user.username} отменил запись на "${booking.service_name}" — ${booking.booking_date} ${booking.booking_time}`
  );
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

  const stats = {
    total: bookings.length,
    active: bookings.filter((booking) => booking.status === "active").length,
    cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
  };

  res.json({ bookings, stats });
});

// GET /api/bookings/busy-times — занятые слоты для даты+услуги
router.get("/busy-times", async (req, res) => {
  const serviceId = parseServiceId(req.query.service_id);
  const bookingDate = typeof req.query.date === "string" ? req.query.date.trim() : "";
  const dayOfWeek = getWeekdayIndexFromDateString(bookingDate);

  if (!serviceId || !bookingDate) {
    return res.status(400).json({ error: "service_id и date обязательны" });
  }

  if (dayOfWeek === null) {
    return res.status(400).json({ error: "Некорректная дата" });
  }

  const slots = await db.allAsync(
    `
      SELECT
        ts.slot_time,
        ts.max_bookings,
        COUNT(b.id) as booked_count
      FROM time_slots ts
      LEFT JOIN bookings b
        ON b.service_id = ts.service_id
        AND b.booking_date = ?
        AND b.booking_time = ts.slot_time
        AND b.status = 'active'
      WHERE ts.service_id = ?
        AND ts.day_of_week = ?
        AND ts.is_active = 1
      GROUP BY ts.id
      ORDER BY ts.slot_time ASC
    `,
    [bookingDate, serviceId, dayOfWeek]
  );

  res.json({
    busy_times: slots
      .filter((slot) => slot.booked_count >= slot.max_bookings)
      .map((slot) => slot.slot_time),
    slots,
  });
});

module.exports = router;
