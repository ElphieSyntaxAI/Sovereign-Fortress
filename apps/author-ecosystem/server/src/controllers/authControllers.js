const db = require("../config/dbConfig");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// User Registration
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  // Basic input validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Define default values for new users
  const defaultTierName = "Tier 1: Fan Access";
  const defaultTheme = "Pleasure";

  try {
    // Fetch the default tier_id ---
    const tierResult = await db.query(
      "SELECT tier_id FROM tiers WHERE name = $1",
      [defaultTierName]
    );

    if (tierResult.rows.length === 0) {
      console.error(`Missing tier: ${defaultTierName} not found in database.`);
      return res
        .status(500)
        .json({ message: "Server configuration error: Base tier missing." });
    }

    const defaultTierId = tierResult.rows[0].tier_id;

    //  Hash Password ---
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert User  ---
    const insertQuery = `
            INSERT INTO users (username, email, password_hash, tier_id, preferred_theme) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING user_id, username, email, tier_id, preferred_theme 
        `;

    const values = [
      username,
      email,
      hashedPassword,
      defaultTierId,
      defaultTheme,
    ];

    const result = await db.query(insertQuery, values);
    const user = result.rows[0];

    // --- Generate JWT ---
    const token = jwt.sign(
      { user_id: user.user_id, tier_id: user.tier_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        tierId: user.tier_id,
        theme: user.preferred_theme,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Username or email already exists" });
    }
    return res
      .status(500)
      .json({ message: "Server error during registration." });
  }
};

// Inside src/controllers/authController.js (Add this after registerUser)

// User Login
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find the user by email
    const userResult = await db.query(
      "SELECT user_id, password_hash, username, email, tier_id, preferred_theme FROM users WHERE email = $1",
      [email]
    );

    const user = userResult.rows[0];

    // Check if user exists
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT (Same logic as registration)
    const token = jwt.sign(
      { user_id: user.user_id, tier_id: user.tier_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Success response
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        tierId: user.tier_id,
        theme: user.preferred_theme,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Server error during login." });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
