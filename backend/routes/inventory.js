const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const AccountingEntry = require('../models/AccountingEntry');

// @route   GET /api/inventory
// @desc    Get all inventory items
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { lowStock } = req.query;
    const query = {};

    if (lowStock === 'true') {
      const inventories = await Inventory.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $match: {
            $expr: {
              $lte: ['$quantity', '$lowStockThreshold']
            },
            'product.isActive': true
          }
        },
        {
          $project: {
            'product.inventory': 0
          }
        }
      ]);

      return res.json(inventories);
    }

    const inventories = await Inventory.find(query)
      .populate('product', 'name sku price category')
      .sort({ quantity: 1 });

    res.json(inventories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/inventory/:id/stock
// @desc    Update inventory stock
// @access  Private (Admin/Manager)
router.put('/:id/stock', 
  [
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    check('quantity', 'Quantity is required').isInt({ min: 0 }),
    check('adjustmentType', 'Adjustment type is required').isIn(['add', 'set'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const inventory = await Inventory.findById(req.params.id).populate('product');
      if (!inventory) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const { quantity, adjustmentType, reason } = req.body;
      const oldQuantity = inventory.quantity;
      let newQuantity;

      if (adjustmentType === 'add') {
        newQuantity = oldQuantity + quantity;
      } else {
        newQuantity = quantity;
      }

      inventory.quantity = newQuantity;
      if (adjustmentType === 'add' && quantity > 0) {
        inventory.lastRestocked = Date.now();
      }

      await inventory.save();

      // Record accounting entry for inventory changes
      if (oldQuantity !== newQuantity) {
        const accountingEntry = new AccountingEntry({
          date: new Date(),
          type: 'inventory',
          amount: Math.abs(newQuantity - oldQuantity) * inventory.product.cost,
          description: `Inventory adjustment: ${reason || 'No reason provided'}`,
          reference: inventory._id,
          category: 'cogs',
          recordedBy: req.user.id
        });

        await accountingEntry.save();
      }

      res.json(inventory);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ error: 'Inventory item not found' });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route   GET /api/inventory/report
// @desc    Get inventory report
// @access  Private (Admin/Manager/Accountant)
router.get('/report', 
  [authMiddleware, roleMiddleware(['admin', 'manager', 'accountant'])],
  async (req, res) => {
    try {
      const report = await Inventory.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $match: {
            'product.isActive': true
          }
        },
        {
          $group: {
            _id: '$product.category',
            totalValue: { 
              $sum: { 
                $multiply: ['$quantity', '$product.cost'] 
              } 
            },
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' }
          }
        },
        {
          $project: {
            category: '$_id',
            totalValue: 1,
            totalItems: 1,
            totalQuantity: 1,
            _id: 0
          }
        },
        { $sort: { totalValue: -1 } }
      ]);

      res.json(report);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;