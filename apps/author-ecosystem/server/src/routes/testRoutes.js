// src/routes/testRoutes.js

const router = require("express").Router();
const { verifyToken, checkTierAccess } = require("../middleware/verifyTokens");

// --- Tier 1 Access ---
router.get("/public-content", verifyToken, (req, res) => {
  // req.user contains { user_id, tier_id } thanks to verifyToken
  res.status(200).json({
    message: "Welcome to Fan Access content!",
    userTier: req.user.tier_id,
  });
});

// --- Tier 2 Access ---
router.get(
  "/author-dashboard",
  verifyToken, // 1. Verify token first
  checkTierAccess(2), // 2. Check if tier_id is 2 or higher
  (req, res) => {
    res.status(200).json({
      message: "Welcome to the Core Author Dashboard!",
      accessLevel: "Tier 2 Required",
    });
  }
);

// --- Tier 3 Access ---
router.get(
  "/premium-tools",
  verifyToken,
  checkTierAccess(3), // 3. Check if tier_id is 3
  (req, res) => {
    res.status(200).json({
      message: "Welcome to Premium Author Tools!",
      accessLevel: "Tier 3 Required",
    });
  }
);

module.exports = router;
