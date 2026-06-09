const db = require("./index");
const bcrypt = require("bcryptjs");

const services = [
  { name: "Стрижка мужская",       description: "Классическая мужская стрижка с мытьём головы и укладкой.", price: 1500, duration: 45 },
  { name: "Стрижка женская",        description: "Женская стрижка любой сложности. Консультация мастера и укладка.", price: 2500, duration: 60 },
  { name: "Окрашивание волос",      description: "Однотонное, мелирование, балаяж. Краски Wella и L'Oréal.", price: 4000, duration: 120 },
  { name: "Маникюр классический",   description: "Маникюр с обработкой кутикулы и покрытием гель-лаком (200+ оттенков).", price: 1800, duration: 60 },
  { name: "Консультация косметолога",description: "Осмотр, подбор процедур, индивидуальный план ухода.", price: 2000, duration: 30 },
];

// Стандартное расписание: пн-сб, каждый час с 9:00 до 17:00
// day_of_week: 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб
const WORK_DAYS = [1, 2, 3, 4, 5, 6];
const TIMES_FULL    = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
const TIMES_SHORT   = ["10:00","11:00","12:00","13:00","14:00","15:00"];  // для длинных услуг
const TIMES_CONSULT = ["09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30"];

async function seed() {
  await new Promise(r => setTimeout(r, 300));
  await db.runAsync("DELETE FROM bookings");
  await db.runAsync("DELETE FROM time_slots");
  await db.runAsync("DELETE FROM services");
  await db.runAsync("DELETE FROM users");

  // Пользователи
  const h1 = await bcrypt.hash("admin123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["admin", h1, "admin"]);
  const h2 = await bcrypt.hash("user123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["demo", h2, "user"]);
  const h3 = await bcrypt.hash("test123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["Андрей", h3, "user"]);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["Артём",  h3, "user"]);

  // Услуги
  for (const s of services) {
    await db.runAsync("INSERT INTO services (name, description, price, duration) VALUES (?,?,?,?)",
      [s.name, s.description, s.price, s.duration]);
  }

  // Time slots — расписание каждой услуги
  // Услуга 1: Стрижка мужская — пн-сб, полное расписание
  for (const d of WORK_DAYS) for (const t of TIMES_FULL)
    await db.runAsync("INSERT INTO time_slots (service_id, day_of_week, slot_time) VALUES (?,?,?)", [1, d, t]);

  // Услуга 2: Стрижка женская — пн-пт, полное расписание
  for (const d of [1,2,3,4,5]) for (const t of TIMES_FULL)
    await db.runAsync("INSERT INTO time_slots (service_id, day_of_week, slot_time) VALUES (?,?,?)", [2, d, t]);

  // Услуга 3: Окрашивание — пн-пт, меньше слотов (длинная услуга 2ч)
  for (const d of [1,2,3,4,5]) for (const t of TIMES_SHORT)
    await db.runAsync("INSERT INTO time_slots (service_id, day_of_week, slot_time) VALUES (?,?,?)", [3, d, t]);

  // Услуга 4: Маникюр — пн-сб, полное расписание
  for (const d of WORK_DAYS) for (const t of TIMES_FULL)
    await db.runAsync("INSERT INTO time_slots (service_id, day_of_week, slot_time) VALUES (?,?,?)", [4, d, t]);

  // Услуга 5: Консультация — пн-пт, по 30 мин
  for (const d of [1,2,3,4,5]) for (const t of TIMES_CONSULT)
    await db.runAsync("INSERT INTO time_slots (service_id, day_of_week, slot_time) VALUES (?,?,?)", [5, d, t]);

  // Тестовые записи
  const d = (off) => { const dt = new Date(); dt.setDate(dt.getDate() + off); return dt.toISOString().split("T")[0]; };
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [2, 1, d(2), "14:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [2, 4, d(3), "11:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [3, 2, d(2), "10:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [4, 5, d(4), "14:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time, status) VALUES (?,?,?,?,?)", [2, 3, d(-1), "12:00", "cancelled"]);

  const slotCount = await db.getAsync("SELECT COUNT(*) as n FROM time_slots");
  console.log("✅ База заполнена:");
  console.log("   Пользователи: admin/admin123, demo/user123, Андрей/test123, Артём/test123");
  console.log(`   Услуг: ${services.length}, Слотов в расписании: ${slotCount.n}, Записей: 5`);
  db.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
