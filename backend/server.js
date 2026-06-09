const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes    = require("./routes/auth");
const serviceRoutes = require("./routes/services");
const bookingRoutes = require("./routes/bookings");
const profileRoutes = require("./routes/profile");
const adminRoutes   = require("./routes/admin");
const slotsRoutes   = require("./routes/slots");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Rate limiting
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use("/api/login",    rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Слишком много попыток" } }));
app.use("/api/register", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Слишком много регистраций" } }));

// Статика фронтенда
app.use(express.static(path.join(__dirname, "../frontend")));

// API маршруты
app.use("/api",                 authRoutes);
app.use("/api/services",        serviceRoutes);
app.use("/api/admin/services",  serviceRoutes);
app.use("/api/bookings",        bookingRoutes);
app.use("/api/profile",         profileRoutes);
app.use("/api/admin",           adminRoutes);
app.use("/api/available-slots", slotsRoutes);
app.use("/api/slots",           slotsRoutes);

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Маршрут не найден" });
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`🏢 BookIt запущен: http://localhost:${PORT}`);
  console.log(`   Админ: admin / admin123 | Пользователь: demo / user123`);
});
