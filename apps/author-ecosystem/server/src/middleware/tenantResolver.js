const db = require("../lib/databaseUrlPool.cjs");

const tenantResolver = async (req, res, next) => {
  const host = req.headers.host;
  try {
    //ASYNC DATABASE LOOKUP
    const result = await db.query(
      "SELECT schema_name FROM msgf_legacy_tenants WHERE domain_name = $1",
      [host]
    );

    if (result.rows.length > 0) {
      req.schema = result.rows[0].schema_name;
      console.log(`Success: Using schema: ${req.schema}`);
    } else {
      req.schema = "public";
      console.log(`Warning: Domain ${host} not recognized. Using public.`);
    }

    // DEV LOGIC (Keep manual checks here)
    if (host.includes("localhost")) {
      req.tenantId = "dev_author";
    } else {
      req.tenantId = host.split(".")[0];
    }

    next();
  } catch (err) {
    // ERROR LOGGING
    console.error("Database error in tenantResolver:", err);
    return res.status(500).json({
      error: "Tenant Resolver Error",
      message: err.message,
      code: err.code,
    });
  }
};

module.exports = tenantResolver;
