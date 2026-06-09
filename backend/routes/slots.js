const express = require("express");
const db = require("../db");
const { adminRequired } = require("../middleware/auth");

const router = express.Router();

// GET /api/available-slots?service_id=1&date=2026-06-15
// Возвращает слоты с их статусом для конкретной услуги и даты
router.get("/", async (req, res) => {
  const { service_id, date } = req.query;
  if (!service_id || !date) {
    return res.status(400).json({ error: "service_id и date обязательны" });
  }

  // Определить день недели (0=Вс, 1=Пн, ..., 6=Сб)
  const dayOfWeek = new Date(date + "T00:00:00").getDay();

  // Получить все активные слоты для этой услуги в этот день недели
  const slots = await db.allAsync(
    `SELECT ts.id, ts.slot_time, ts.max_bookings
     FROM time_slots ts
     WHERE ts.service_id = ? AND ts.day_of_week = ? AND ts.is_active = 1
     ORDER BY ts.slot_time ASC`,
    [service_id, dayOfWeek]
  );

  if (slots.length === 0) {
    return res.json({ slots: [], message: "В этот день нет доступных слотов" });
  }

  // Для каждого слота проверить сколько уже занято
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const result = await Promise.all(slots.map(async (slot) => {
    const booked = await db.getAsync(
      `SELECT COUNT(*) as count FROM bookings
       WHERE service_id = ? AND booking_date = ?
       AND booking_time = ? AND status = 'active'`,
      [service_id, date, slot.slot_time]
    );
    const bookedCount = booked?.count || 0;
    const isPast = date === today && slot.slot_time <= currentTime;

    return {
      id: slot.id,
      time: slot.slot_time,
      max_bookings: slot.max_bookings,
      booked_count: bookedCount,
      available: slot.max_bookings - bookedCount,
      is_available: bookedCount < slot.max_bookings && !isPast,
      is_past: isPast,
    };
  }));

  res.json({ slots: result, date, day_of_week: dayOfWeek });
});

// POST /api/slots — создать слот (только Admin)
router.post("/", adminRequired, async (req, res) => {
  const { service_id, day_of_week, slot_time, max_bookings } = req.body;
  if (!service_id || day_of_week === undefined || !slot_time) {
    return res.status(400).json({ error: "service_id, day_of_week, slot_time обязательны" });
  }
  if (day_of_week < 0 || day_of_week > 6) {
    return res.status(400).json({ error: "day_of_week от 0 (Вс) до 6 (Сб)" });
  }

  const service = await db.getAsync("SELECT id, name FROM services WHERE id = ? AND active = 1", [service_id]);
  if (!service) return res.status(404).json({ error: "Услуга не найдена" });

  // Проверить уникальность
  const existing = await db.getAsync(
    "SELECT id FROM time_slots WHERE service_id = ? AND day_of_week = ? AND slot_time = ?",
    [service_id, day_of_week, slot_time]
  );
  if (existing) return res.status(409).json({ error: "Этот слот уже существует" });

  const result = await db.runAsync(
    "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
    [service_id, day_of_week, slot_time, max_bookings || 1]
  );

  const DAYS = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  console.log(`[LOG] Слот добавлен: ${service.name} — ${DAYS[day_of_week]} ${slot_time}`);
  res.status(201).json({
    message: `Слот добавлен: ${DAYS[day_of_week]} ${slot_time}`,
    slot: { id: result.lastID, service_id, day_of_week, slot_time, max_bookings: max_bookings || 1 }
  });
});

// DELETE /api/slots/:id — удалить слот (Admin)
router.delete("/:id", adminRequired, async (req, res) => {
  const slot = await db.getAsync("SELECT * FROM time_slots WHERE id = ?", [req.params.id]);
  if (!slot) return res.status(404).json({ error: "Слот не найден" });

  await db.runAsync("UPDATE time_slots SET is_active = 0 WHERE id = ?", [req.params.id]);
  res.json({ message: "Слот деактивирован" });
});

// GET /api/slots/service/:serviceId — расписание услуги (для Admin)
router.get("/service/:serviceId", adminRequired, async (req, res) => {
  const slots = await db.allAsync(
    `SELECT ts.*, s.name as service_name
     FROM time_slots ts JOIN services s ON ts.service_id = s.id
     WHERE ts.service_id = ? AND ts.is_active = 1
     ORDER BY ts.day_of_week, ts.slot_time`,
    [req.params.serviceId]
  );
  const DAYS = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  res.json({ slots: slots.map(s => ({ ...s, day_name: DAYS[s.day_of_week] })) });
});

module.exports = router;
