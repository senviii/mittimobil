const express = require('express');
const Farmer = require('../models/Farmer');
const Equipment = require('../models/Equipment');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/auth');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.farmerId).select('-password');
    res.json(farmer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'village', 'panchayat', 'district', 'state', 'location', 'landSize', 'language'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const farmer = await Farmer.findByIdAndUpdate(
      req.farmerId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', farmer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/me/dashboard', authMiddleware, async (req, res) => {
  try {
    const myEquipment = await Equipment.countDocuments({ owner: req.farmerId });
    const availableEquipment = await Equipment.countDocuments({ owner: req.farmerId, status: 'available' });
    const bookedEquipment = await Equipment.countDocuments({ owner: req.farmerId, status: 'booked' });

    const pendingBookings = await Booking.countDocuments({ owner: req.farmerId, status: 'pending' });
    const activeBookings = await Booking.countDocuments({ owner: req.farmerId, status: 'active' });
    const completedBookings = await Booking.countDocuments({ owner: req.farmerId, status: 'completed' });

    const myActiveRentals = await Booking.countDocuments({ renter: req.farmerId, status: { $in: ['confirmed', 'active'] } });
    const myCompletedRentals = await Booking.countDocuments({ renter: req.farmerId, status: 'completed' });

    const earningsData = await Booking.aggregate([
      { $match: { owner: req.farmer._id, status: 'completed', paymentStatus: 'completed' } },
      { $group: { _id: null, totalEarnings: { $sum: '$totalPrice' } } }
    ]);

    const totalEarnings = earningsData.length > 0 ? earningsData[0].totalEarnings : 0;

    res.json({
      equipment: { total: myEquipment, available: availableEquipment, booked: bookedEquipment },
      bookings: { pending: pendingBookings, active: activeBookings, completed: completedBookings },
      rentals: { active: myActiveRentals, completed: myCompletedRentals },
      earnings: { total: totalEarnings }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.params.id)
      .select('name village panchayat district rating totalRatings isEquipmentOwner');

    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    const equipmentCount = await Equipment.countDocuments({ owner: req.params.id });
    const completedBookings = await Booking.countDocuments({ owner: req.params.id, status: 'completed' });

    res.json({
      farmer,
      stats: { equipmentCount, completedBookings }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/farmers/me/dashboard
// GET /api/farmers/me/dashboard - Dashboard stats
router.get('/me/dashboard', auth, async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    
    const Equipment = require('../models/Equipment');
    const Booking = require('../models/Booking');
    
    // Get equipment stats
    const totalEquipment = await Equipment.countDocuments({ owner: farmerId });
    const availableEquipment = await Equipment.countDocuments({ owner: farmerId, available: true });
    
    // Get booking stats
    const myEquipmentIds = await Equipment.find({ owner: farmerId }).distinct('_id');
    
    const pendingBookings = await Booking.countDocuments({
      equipment: { $in: myEquipmentIds },
      status: 'pending'
    });
    
    const activeBookings = await Booking.countDocuments({
      equipment: { $in: myEquipmentIds },
      status: 'confirmed'
    });
    
    const completedBookings = await Booking.countDocuments({
      equipment: { $in: myEquipmentIds },
      status: 'completed'
    });
    
    // Get earnings (if you track them)
    const earnings = await Booking.aggregate([
      { 
        $match: { 
          equipment: { $in: myEquipmentIds },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' }
        }
      }
    ]);
    
    res.json({
      equipment: {
        total: totalEquipment,
        available: availableEquipment
      },
      bookings: {
        pending: pendingBookings,
        active: activeBookings,
        completed: completedBookings
      },
      earnings: {
        total: earnings[0]?.total || 0
      },
      rentals: {
        active: activeBookings,
        completed: completedBookings
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Error loading dashboard', error: error.message });
  }
});

module.exports = router;
