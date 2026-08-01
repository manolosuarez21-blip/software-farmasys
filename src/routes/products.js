const express = require('express');
const { getAll, create, updateById, deleteById } = require('../controllers/productController');

const router = express.Router();

router.get('/', getAll);
router.post('/', create);
router.put('/:id', updateById);
router.delete('/:id', deleteById);

module.exports = router;
