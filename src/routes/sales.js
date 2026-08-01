const express = require('express');
const { create, getAll, getItems } = require('../controllers/saleController');

const router = express.Router();

router.post('/', create);
router.get('/', getAll);
router.get('/:id/items', getItems);

module.exports = router;
