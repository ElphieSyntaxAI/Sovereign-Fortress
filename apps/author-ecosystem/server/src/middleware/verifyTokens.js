// src/middleware/verifyTokens.js
const jwt = require("jsonwebtoken");

/**
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token or expired token." });
  }
};

/**
 * @param {number} requiredTierId - The minimum tier_id required to access the route
 * @returns {function} Express middleware function
 */
const checkTierAccess = (requiredTierId) => (req, res, next) => {
  const tier = req.user?.tier_id ?? req.user?.tierId;
  if (!tier) return res.status(401).json({ message: "Access denied. Missing tier." });

  if (Number(tier) >= Number(requiredTierId)) return next();

  return res.status(403).json({
    message: `Access forbidden. Minimum required Tier ID: ${requiredTierId}`,
  });
};

module.exports = {
  verifyToken,
  checkTierAccess,
};
