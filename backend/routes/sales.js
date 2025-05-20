const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Sale = require('../models/sale');
const AccountingEntry = require('../models/AccountingEntry');

// @route   POST /api/sales
// @desc    Process a new sale
// @access  Private
router.post(
  '/',
  [
    authMiddleware,
    check('items', 'Sale items are required').isArray({ min: 1 }),
    check('items.*.product', 'Product ID is required').not().isEmpty(),
    check('items.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
    check('payments', 'Payment information is required').isArray({ min: 1 }),
    check('payments.*.method', 'Payment method is required').not().isEmpty(),
    check('payments.*.amount', 'Payment amount must be positive').isFloat({ min: 0 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await Sale.startSession();
    session.startTransaction();

    try {
      const { items, payments, customer, notes } = req.body;
      const employee = req.user.id;

      // Validate products and calculate totals
      let subtotal = 0;
      let tax = 0;
      const saleItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product).session(session);
        if (!product || !product.isActive) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: `Product ${item.product} not found or inactive` });
        }

        // Check inventory
        const inventory = await Inventory.findOne({ product: item.product }).session(session);
        if (!inventory || inventory.quantity < item.quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            error: `Insufficient stock for product ${product.name}`,
            available: inventory ? inventory.quantity : 0
          });
        }

        // Calculate item total
        const itemTotal = product.price * item.quantity;
        const itemTax = itemTotal * (product.taxRate / 100);
        
        subtotal += itemTotal;
        tax += itemTax;

        saleItems.push({
          product: product._id,
          quantity: item.quantity,
          unitPrice: product.price,
          discount: item.discount || 0
        });

        // Update inventory
        inventory.quantity -= item.quantity;
        await inventory.save({ session });
      }

      // Calculate total
      const total = subtotal + tax;

      // Validate payments
      const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (paymentTotal < total) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Insufficient payment amount' });
      }

      const changeDue = paymentTotal - total;

      // Create sale record
      const sale = new Sale({
        items: saleItems,
        subtotal,
        tax,
        total,
        payments,
        changeDue,
        employee,
        customer,
        notes
      });

      await sale.save({ session });

      // Record accounting entries
      const accountingEntry = new AccountingEntry({
        date: new Date(),
        type: 'sale',
        amount: total,
        description: `Sale #${sale._id}`,
        reference: sale._id,
        category: 'revenue',
        recordedBy: employee
      });

      await accountingEntry.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json(sale);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET /api/sales
// @desc    Get all sales
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (employee) query.employee = employee;

    const sales = await Sale.find(query)
      .populate('employee', 'username')
      .populate('customer', 'name')
      .populate('items.product', 'name sku price')
      .sort({ createdAt: -1 });

    res.json(sales);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/sales/:id
// @desc    Get sale by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('employee', 'username')
      .populate('customer', 'name email phone')
      .populate('items.product', 'name sku price taxRate');

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST /api/sales/:id/refund
// @desc    Process a refund
// @access  Private (Admin/Manager)
router.post('/:id/refund', 
  [
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    check('reason', 'Refund reason is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await Sale.startSession();
    session.startTransaction();

    try {
      const sale = await Sale.findById(req.params.id).session(session);
      if (!sale) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'Sale not found' });
      }

      if (sale.status === 'refunded') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Sale already refunded' });
      }

      // Update sale status
      sale.status = 'refunded';
      sale.notes = `Refund: ${req.body.reason}. Processed by ${req.user.id}`;
      await sale.save({ session });

      // Return items to inventory
      for (const item of sale.items) {
        const inventory = await Inventory.findOne({ product: item.product }).session(session);
        if (inventory) {
          inventory.quantity += item.quantity;
          await inventory.save({ session });
        }
      }

      // Record accounting entry for refund
      const accountingEntry = new AccountingEntry({
        date: new Date(),
        type: 'sale',
        amount: -sale.total,
        description: `Refund for sale #${sale._id}: ${req.body.reason}`,
        reference: sale._id,
        category: 'revenue',
        recordedBy: req.user.id
      });

      await accountingEntry.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.json(sale);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;