// routes/analytics.js
const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const Booking = require('../models/Booking');
const Farmer = require('../models/Farmer');

// GET /api/analytics/overview
router.get('/overview', async (req, res) => {
  try {
    // Total counts
    const totalEquipment = await Equipment.countDocuments();
    const totalFarmers = await Farmer.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const activeEquipment = await Equipment.countDocuments({ available: true });
    
    // Equipment by type
    const equipmentByType = await Equipment.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { type: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Top locations by equipment count
    const topLocations = await Equipment.aggregate([
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $project: { location: '$_id', bookings: '$count', _id: 0 } },
      { $sort: { bookings: -1 } },
      { $limit: 5 }
    ]);
    
    // Recent bookings
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('renter', 'name')
      .populate('equipment', 'name type');
    
    // Calculate total revenue (from completed bookings)
    const revenueData = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
    ]);
    
    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    
    res.json({
      overview: {
        totalEquipment,
        totalFarmers,
        totalBookings,
        activeEquipment,
        totalRevenue
      },
      equipmentByType,
      topLocations,
      recentBookings: recentBookings.map(b => ({
        id: b._id,
        farmer: b.renter?.name,
        equipment: b.equipment?.name,
        type: b.equipment?.type,
        date: b.startDate,
        amount: b.totalPrice,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// GET /api/analytics/earnings - Get earnings by owner
router.get('/earnings', async (req, res) => {
  try {
    const earnings = await Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'equipment',
          localField: 'equipment',
          foreignField: '_id',
          as: 'equipmentData'
        }
      },
      { $unwind: '$equipmentData' },
      {
        $group: {
          _id: '$equipmentData.owner',
          totalEarnings: { $sum: '$totalPrice' },
          bookingCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'farmers',
          localField: '_id',
          foreignField: '_id',
          as: 'ownerData'
        }
      },
      { $unwind: '$ownerData' },
      {
        $project: {
          farmerId: '$_id',
          name: '$ownerData.name',
          totalEarnings: 1,
          bookingCount: 1
        }
      },
      { $sort: { totalEarnings: -1 } }
    ]);
    
    res.json({ earnings });
  } catch (error) {
    console.error('Earnings error:', error);
    res.status(500).json({ message: 'Error fetching earnings' });
  }
});

module.exports = router;