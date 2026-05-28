const db = require("./index");
const bcrypt = require("bcryptjs");

const services = [
  { name: "Стрижка мужская", description: "Классическая мужская стрижка с мытьём головы и укладкой. Мастер подберёт форму по типу лица.", price: 1500, duration: 45 },
  { name: "Стрижка женская", description: "Женская стрижка любой сложности: от каре до каскада. Включена консультация мастера и укладка.", price: 2500, duration: 60 },
  { name: "Окрашивание волос", description: "Профессиональное окрашивание: однотонное, мелирование, балаяж. Используем краски Wella и L'Oréal.", price: 4000, duration: 120 },
  { name: "Маникюр классический", description: "Классический маникюр с обработкой кутикулы и покрытием гель-лаком на выбор (200+ оттенков).", price: 1800, duration: 60 },
  { name: "Консультация косметолога", description: "Первичная консультация: осмотр кожи, подбор процедур, составление индивидуального плана ухода.", price: 2000, duration: 30 },
];

async function seed() {
  await new Promise(r => setTimeout(r, 300));
  await db.runAsync("DELETE FROM bookings");
  await db.runAsync("DELETE FROM services");
  await db.runAsync("DELETE FROM users");

  // Admin
  const h1 = await bcrypt.hash("admin123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["admin", h1, "admin"]);

  // Demo user
  const h2 = await bcrypt.hash("user123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["demo", h2, "user"]);

  // Extra test users
  const h3 = await bcrypt.hash("test123", 10);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["Андрей", h3, "user"]);
  await db.runAsync("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)", ["Артём", h3, "user"]);

  // Services
  for (const s of services) {
    await db.runAsync("INSERT INTO services (name, description, price, duration) VALUES (?,?,?,?)", [s.name, s.description, s.price, s.duration]);
  }

  // Demo bookings
  const d = (offset) => { const dt = new Date(); dt.setDate(dt.getDate() + offset); return dt.toISOString().split("T")[0]; };
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [2, 1, d(2), "14:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [2, 4, d(3), "11:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [3, 2, d(2), "10:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)", [4, 5, d(4), "16:00"]);
  await db.runAsync("INSERT INTO bookings (user_id, service_id, booking_date, booking_time, status) VALUES (?,?,?,?,?)", [2, 3, d(-1), "12:00", "cancelled"]);

  console.log("✅ База заполнена:");
  console.log("   Админ: admin / admin123");
  console.log("   Пользователи: demo / user123, Андрей / test123, Артём / test123");
  console.log(`   ${services.length} услуг, 5 записей (4 активных + 1 отменённая)`);
  db.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
