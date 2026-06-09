const db = require("./index");
const bcrypt = require("bcryptjs");
const { DEFAULT_TIME_ZONE, getDatePartsInTimeZone } = require("../lib/time");

const services = [
  {
    name: "Стрижка мужская",
    description: "Классическая мужская стрижка с мытьём головы и укладкой.",
    price: 1500,
    duration: 45,
  },
  {
    name: "Стрижка женская",
    description: "Женская стрижка любой сложности. Консультация мастера и укладка.",
    price: 2500,
    duration: 60,
  },
  {
    name: "Окрашивание волос",
    description: "Однотонное, мелирование, балаяж. Краски Wella и L'Oréal.",
    price: 4000,
    duration: 120,
  },
  {
    name: "Маникюр классический",
    description: "Маникюр с обработкой кутикулы и покрытием гель-лаком (200+ оттенков).",
    price: 1800,
    duration: 60,
  },
  {
    name: "Консультация косметолога",
    description: "Осмотр, подбор процедур, индивидуальный план ухода.",
    price: 2000,
    duration: 30,
  },
];

const WORK_DAYS = [1, 2, 3, 4, 5, 6];
const TIMES_FULL = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const TIMES_SHORT = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const TIMES_CONSULT = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30"];

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekday(targetWeekday, minimumDaysAhead = 1) {
  const today = getDatePartsInTimeZone(new Date(), DEFAULT_TIME_ZONE).date;
  let candidate = addDays(today, minimumDaysAhead);

  for (let index = 0; index < 14; index += 1) {
    const weekday = new Date(`${candidate}T00:00:00Z`).getUTCDay();
    if (weekday === targetWeekday) {
      return candidate;
    }

    candidate = addDays(candidate, 1);
  }

  return addDays(today, minimumDaysAhead);
}

async function seed() {
  await db.ready;

  await db.runAsync("DELETE FROM bookings");
  await db.runAsync("DELETE FROM time_slots");
  await db.runAsync("DELETE FROM services");
  await db.runAsync("DELETE FROM users");
  await db.runAsync("DELETE FROM sqlite_sequence");

  const adminHash = await bcrypt.hash("admin123", 10);
  const userHash = await bcrypt.hash("user123", 10);
  const demoHash = await bcrypt.hash("test123", 10);

  await db.runAsync(
    "INSERT INTO users (username, password_hash, role, timezone) VALUES (?,?,?,?)",
    ["admin", adminHash, "admin", "Europe/Moscow"]
  );
  await db.runAsync(
    "INSERT INTO users (username, password_hash, role, timezone) VALUES (?,?,?,?)",
    ["demo", userHash, "user", "Europe/Moscow"]
  );
  await db.runAsync(
    "INSERT INTO users (username, password_hash, role, timezone) VALUES (?,?,?,?)",
    ["Андрей", demoHash, "user", "Asia/Yekaterinburg"]
  );
  await db.runAsync(
    "INSERT INTO users (username, password_hash, role, timezone) VALUES (?,?,?,?)",
    ["Артём", demoHash, "user", "Europe/Kaliningrad"]
  );

  for (const service of services) {
    await db.runAsync(
      "INSERT INTO services (name, description, price, duration) VALUES (?,?,?,?)",
      [service.name, service.description, service.price, service.duration]
    );
  }

  const slotCapacityOverrides = {
    1: { "14:00": 2, "15:00": 2 },
    3: { "14:00": 2 },
    5: { "14:00": 3 },
  };

  for (const day of WORK_DAYS) {
    for (const time of TIMES_FULL) {
      await db.runAsync(
        "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
        [1, day, time, slotCapacityOverrides[1][time] || 1]
      );
    }
  }

  for (const day of [1, 2, 3, 4, 5]) {
    for (const time of TIMES_FULL) {
      await db.runAsync(
        "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
        [2, day, time, slotCapacityOverrides[2]?.[time] || 1]
      );
    }
  }

  for (const day of [1, 2, 3, 4, 5]) {
    for (const time of TIMES_SHORT) {
      await db.runAsync(
        "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
        [3, day, time, slotCapacityOverrides[3][time] || 1]
      );
    }
  }

  for (const day of WORK_DAYS) {
    for (const time of TIMES_FULL) {
      await db.runAsync(
        "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
        [4, day, time, slotCapacityOverrides[4]?.[time] || 1]
      );
    }
  }

  for (const day of [1, 2, 3, 4, 5]) {
    for (const time of TIMES_CONSULT) {
      await db.runAsync(
        "INSERT INTO time_slots (service_id, day_of_week, slot_time, max_bookings) VALUES (?,?,?,?)",
        [5, day, time, slotCapacityOverrides[5][time] || 1]
      );
    }
  }

  const nextMonday = nextWeekday(1, 1);
  const nextTuesday = nextWeekday(2, 1);
  const nextWednesday = nextWeekday(3, 1);
  const previousDay = addDays(getDatePartsInTimeZone(new Date(), DEFAULT_TIME_ZONE).date, -1);

  await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)",
    [2, 1, nextMonday, "14:00"]
  );
  await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)",
    [3, 1, nextMonday, "14:00"]
  );
  await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)",
    [2, 4, nextTuesday, "11:00"]
  );
  await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?,?,?,?)",
    [4, 5, nextWednesday, "14:00"]
  );
  await db.runAsync(
    "INSERT INTO bookings (user_id, service_id, booking_date, booking_time, status) VALUES (?,?,?,?,?)",
    [2, 3, previousDay, "12:00", "cancelled"]
  );

  const slotCount = await db.getAsync("SELECT COUNT(*) as n FROM time_slots");
  console.log("✅ База заполнена:");
  console.log("   Пользователи: admin/admin123, demo/user123, Андрей/test123, Артём/test123");
  console.log(`   Услуг: ${services.length}, Слотов в расписании: ${slotCount.n}, Записей: 5`);

  db.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
