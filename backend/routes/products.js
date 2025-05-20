const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

// @route   POST /api/products
// @desc    Create a new product
// @access  Public
router.post(
  '/',
  async (req, res) => {
    // ...add product logic...
  }
);

// @route   GET /api/products
// @desc    Get all products
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, activeOnly, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (activeOnly === 'true') query.isActive = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ name: 1 })
      .populate('inventory', 'quantity');

    res.json(products);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('inventory', 'quantity lowStockThreshold');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Public
router.put('/:id',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price must be a positive number').isFloat({ min: 0 }),
    check('cost', 'Cost must be a positive number').isFloat({ min: 0 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Public
router.delete('/:id',
  async (req, res) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ message: 'Product deactivated' });
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;