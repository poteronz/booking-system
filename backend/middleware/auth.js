const jwt = require("jsonwebtoken");

const JWT_SECRET = "booking_system_secret_2026";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Требуется авторизация" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Недействительный токен" });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Доступ запрещён. Требуются права администратора" });
    }
    next();
  });
}

module.exports = { JWT_SECRET, generateToken, authRequired, adminRequired };
