const express = require("express");
const db = require("../db");
const { adminRequired } = require("../middleware/auth");
const {
  DEFAULT_TIME_ZONE,
  getWeekdayIndexFromDateString,
  isPastDateTime,
  normalizeTimeString,
} = require("../lib/time");

const router = express.Router();
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function parseServiceId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDayOfWeek(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : null;
}

// GET /api/available-slots?service_id=1&date=2026-06-15
// Возвращает слоты с их статусом для конкретной услуги и даты
router.get("/", async (req, res) => {
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
      SELECT ts.id, ts.slot_time, ts.max_bookings
      FROM time_slots ts
      WHERE ts.service_id = ?
        AND ts.day_of_week = ?
        AND ts.is_active = 1
      ORDER BY ts.slot_time ASC
    `,
    [serviceId, dayOfWeek]
  );

  if (slots.length === 0) {
    return res.json({ slots: [], message: "В этот день нет доступных слотов" });
  }

  const result = await Promise.all(
    slots.map(async (slot) => {
      const booked = await db.getAsync(
        `
          SELECT COUNT(*) as count
          FROM bookings
          WHERE service_id = ?
            AND booking_date = ?
            AND booking_time = ?
            AND status = 'active'
        `,
        [serviceId, bookingDate, slot.slot_time]
      );

      const bookedCount = Number(booked?.count || 0);
      const maxBookings = Math.max(1, Number(slot.max_bookings) || 1);
      const isPast = isPastDateTime(bookingDate, slot.slot_time, DEFAULT_TIME_ZONE);

      return {
        id: slot.id,
        time: slot.slot_time,
        max_bookings: maxBookings,
        booked_count: bookedCount,
        available: Math.max(maxBookings - bookedCount, 0),
        is_available: bookedCount < maxBookings && !isPast,
        is_past: isPast,
      };
    })
  );

  res.json({ slots: result, date: bookingDate, day_of_week: dayOfWeek });
});

// POST /api/slots — создать слот (только Admin)
router.post("/", adminRequired, async (req, res) => {
  const serviceId = parseServiceId(req.body.service_id);
  const dayOfWeek = parseDayOfWeek(req.body.day_of_week);
  const slotTime = normalizeTimeString(req.body.slot_time);
  const maxBookingsRaw = Number.parseInt(req.body.max_bookings, 10);
  const maxBookings = Number.isInteger(maxBookingsRaw) && maxBookingsRaw > 0 ? maxBookingsRaw : 1;

  if (!serviceId || dayOfWeek === null || !slotTime) {
    return res.status(400).json({ error: "service_id, day_of_week, slot_time обязательны" });
  }

  if (maxBookings < 1 || maxBookings > 20) {
    return res.status(400).json({ error: "max_bookings должен быть от 1 до 20" });
  }

  const service = await db.getAsync("SELECT id, name FROM services WHERE id = ? AND active = 1", [serviceId]);
  if (!service) {
    return res.status(404).json({ error: "Услуга не найдена" });
  }

  const existing = await db.getAsync(
    "SELECT id FROM time_slots WHERE service_id = ? AND day_of_week = ? AND slot_time = ?",
    [serviceId, dayOfWeek, slotTime]
  );

  if (existing) {
    return res.status(409).json({ error: "Этот слот уже существует" });
  }

  const result = await db.runAsync(
    "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
    [serviceId, dayOfWeek, slotTime, maxBookings]
  );

  console.log(`[LOG] Слот добавлен: ${service.name} — ${DAYS[dayOfWeek]} ${slotTime}`);
  res.status(201).json({
    message: `Слот добавлен: ${DAYS[dayOfWeek]} ${slotTime}`,
    slot: {
      id: result.lastID,
      service_id: serviceId,
      day_of_week: dayOfWeek,
      slot_time: slotTime,
      max_bookings: maxBookings,
    },
  });
});

// DELETE /api/slots/:id — удалить слот (Admin)
router.delete("/:id", adminRequired, async (req, res) => {
  const slot = await db.getAsync("SELECT * FROM time_slots WHERE id = ?", [req.params.id]);
  if (!slot) {
    return res.status(404).json({ error: "Слот не найден" });
  }

  await db.runAsync("UPDATE time_slots SET is_active = 0 WHERE id = ?", [req.params.id]);
  res.json({ message: "Слот деактивирован" });
});

// GET /api/slots/service/:serviceId — расписание услуги (для Admin)
router.get("/service/:serviceId", adminRequired, async (req, res) => {
  const serviceId = parseServiceId(req.params.serviceId);
  if (!serviceId) {
    return res.status(400).json({ error: "Некорректный serviceId" });
  }

  const slots = await db.allAsync(
    `
      SELECT ts.*, s.name as service_name
      FROM time_slots ts
      JOIN services s ON ts.service_id = s.id
      WHERE ts.service_id = ? AND ts.is_active = 1
      ORDER BY ts.day_of_week, ts.slot_time
    `,
    [serviceId]
  );

  res.json({
    slots: slots.map((slot) => ({
      ...slot,
      day_name: DAYS[slot.day_of_week],
    })),
  });
});

module.exports = router;
