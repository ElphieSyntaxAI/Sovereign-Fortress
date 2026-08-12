const router = require("express").Router();
const { betaSignup } = require("../controllers/betaSignup.controller");

router.post("/", betaSignup);

module.exports = router;
