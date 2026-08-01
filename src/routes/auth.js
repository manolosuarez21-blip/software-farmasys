const express = require('express');
const { login, health } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.get('/health', health);

module.exports = router;
