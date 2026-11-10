
const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret.length < 32) {
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "Aarogya Drishti",
      audience: "Aarogya Drishti Application",
    });

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Reusable role authorization
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
};

// Super Admin only
const requireSuperAdmin = requireRole("SYSTEM_ADMIN");

// District Admin only
const requireDistrictAdmin = requireRole("DISTRICT_ADMIN");

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireDistrictAdmin,
};
