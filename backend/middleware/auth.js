const jwt = require("jsonwebtoken");
const { DEFAULT_TIME_ZONE } = require("../lib/time");

const JWT_SECRET = "booking_system_secret_2026";

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      timezone: user.timezone || DEFAULT_TIME_ZONE,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Ð¢Ñ€ÐµÐ±ÑƒÐµÑ‚ÑÑ Ð°Ð²Ñ‚Ð¾Ñ€Ð¸Ð·Ð°Ñ†Ð¸Ñ" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      ...payload,
      timezone: payload.timezone || DEFAULT_TIME_ZONE,
    };
    next();
  } catch {
    return res.status(401).json({ error: "ÐÐµÐ´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ð¹ Ñ‚Ð¾ÐºÐµÐ½" });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Ð”Ð¾ÑÑ‚ÑƒÐ¿ Ð·Ð°Ð¿Ñ€ÐµÑ‰Ñ‘Ð½. Ð¢Ñ€ÐµÐ±ÑƒÑŽÑ‚ÑÑ Ð¿Ñ€Ð°Ð²Ð° Ð°Ð´Ð¼Ð¸Ð½Ð¸ÑÑ‚Ñ€Ð°Ñ‚Ð¾Ñ€Ð°" });
    }
    next();
  });
}

module.exports = { JWT_SECRET, generateToken, authRequired, adminRequired };
