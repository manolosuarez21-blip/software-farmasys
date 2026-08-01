const express = require('express');
const { getAll, create, deleteById } = require('../controllers/userController');

const router = express.Router();

router.get('/', getAll);
router.post('/', create);
router.delete('/:id', deleteById);

module.exports = router;
