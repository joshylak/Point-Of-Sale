const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const AccountingEntry = require('../models/AccountingEntry');
const moment = require('moment');

// @route   GET /api/accounting
// @desc    Get all accounting entries
// @access  Private (Admin/Accountant)
router.get('/', 
  [authMiddleware, roleMiddleware(['admin', 'accountant'])],
  async (req, res) => {
    try {
      const { startDate, endDate, type, category } = req.query;
      const query = {};

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      if (type) query.type = type;
      if (category) query.category = category;

      const entries = await AccountingEntry.find(query)
        .populate('recordedBy', 'username')
        .sort({ date: -1 });

      res.json(entries);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   POST /api/accounting
// @desc    Create a manual accounting entry
// @access  Private (Admin/Accountant)
router.post('/', 
  [
    authMiddleware,
    roleMiddleware(['admin', 'accountant']),
    [
      check('date', 'Date is required').not().isEmpty(),
      check('type', 'Type is required').not().isEmpty(),
      check('amount', 'Amount must be a number').isFloat(),
      check('description', 'Description is required').not().isEmpty(),
      check('category', 'Category is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const entry = new AccountingEntry({
        ...req.body,
        recordedBy: req.user.id
      });

      await entry.save();
      res.status(201).json(entry);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET /api/accounting/summary
// @desc    Get accounting summary
// @access  Private (Admin/Accountant)
router.get('/summary', 
  [authMiddleware, roleMiddleware(['admin', 'accountant'])],
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const match = {};

      if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = new Date(startDate);
        if (endDate) match.date.$lte = new Date(endDate);
      }

      // Daily summary
      const dailySummary = await AccountingEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              day: { $dayOfMonth: '$date' }
            },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$type', 'sale'] },
                    { $gt: ['$amount', 0] }
                  ]},
                  '$amount',
                  0
                ]
              }
            },
            totalExpenses: {
              $sum: {
                $cond: [
                  { $or: [
                    { $ne: ['$type', 'sale'] },
                    { $lt: ['$amount', 0] }
                  ]},
                  { $abs: '$amount' },
                  0
                ]
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $dateFromParts: {
                    year: '$_id.year',
                    month: '$_id.month',
                    day: '$_id.day'
                  }
                }
              }
            },
            totalRevenue: 1,
            totalExpenses: 1,
            netProfit: { $subtract: ['$totalRevenue', '$totalExpenses'] },
            count: 1,
            _id: 0
          }
        },
        { $sort: { date: 1 } }
      ]);

      // Category breakdown
      const categoryBreakdown = await AccountingEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            category: '$_id',
            total: 1,
            count: 1,
            _id: 0
          }
        },
                { $sort: { total: -1 } }
              ]);
        
              res.json({ dailySummary, categoryBreakdown });
            } catch (err) {
              console.error(err.message);
              res.status(500).send('Server error');
            }
          }
        );

module.exports = router;