const express = require('express');
const { getSalesReport, getStockValuationReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/ventas', getSalesReport);
router.get('/stock', getStockValuationReport);

module.exports = router;
