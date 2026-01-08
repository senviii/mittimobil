const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Equipment = require('../models/Equipment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings - Create new booking
router.post('/', authMiddleware, [
  body('equipmentId').notEmpty().withMessage('Equipment ID is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    console.log('=== CREATE BOOKING REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User ID from auth:', req.userId);
    console.log('User role from auth:', req.userRole);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { equipmentId, startDate, endDate, deliveryLocation, deliveryType, notes } = req.body;
    const userId = req.userId; // Fixed: use req.userId from auth middleware

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
    }

    const equipment = await Equipment.findById(equipmentId);
    
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    console.log('Equipment found:', {
      id: equipment._id,
      name: equipment.name,
      status: equipment.status,
      owner: equipment.owner
    });

    if (equipment.status !== 'available') {
      return res.status(400).json({ message: 'Equipment is not available' });
    }

    // Check if user is trying to book their own equipment
    if (equipment.owner.toString() === userId.toString()) {
      return res.status(400).json({ message: 'Cannot book your own equipment' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours <= 0) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    let totalPrice;
    if (diffDays > 0 && equipment.pricePerDay) {
      totalPrice = diffDays * equipment.pricePerDay;
    } else {
      totalPrice = diffHours * equipment.pricePerHour;
    }

    console.log('Booking calculation:', {
      diffHours,
      diffDays,
      totalPrice,
      pricePerHour: equipment.pricePerHour,
      pricePerDay: equipment.pricePerDay
    });

    const booking = new Booking({
      equipment: equipmentId,
      renter: userId,
      owner: equipment.owner,
      startDate: start,
      endDate: end,
      duration: { hours: diffHours, days: diffDays },
      pricePerUnit: equipment.pricePerHour,
      totalPrice,
      deliveryLocation,
      deliveryType: deliveryType || 'pickup',
      notes,
      status: 'pending'
    });

    await booking.save();
    console.log('Booking saved successfully:', booking._id);

    // Update equipment status
    equipment.status = 'booked';
    equipment.currentBooking = booking._id;
    equipment.totalBookings = (equipment.totalBookings || 0) + 1;
    await equipment.save();

    console.log('Equipment updated to booked status');

    const populatedBooking = await Booking.findById(booking._id)
      .populate('equipment', 'name type brand model')
      .populate('owner', 'name phone village')
      .populate('renter', 'name phone village');

    res.status(201).json({ 
      message: 'Booking created successfully', 
      booking: populatedBooking 
    });

  } catch (error) {
    console.error('=== ERROR CREATING BOOKING ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: error.toString()
    });
  }
});

// GET /api/bookings/my-rentals - Get bookings as renter
router.get('/my-rentals', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.userId; // Fixed: use req.userId
    
    let query = { renter: userId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('equipment', 'name type brand model pricePerHour')
      .populate('owner', 'name phone village')
      .sort({ createdAt: -1 });

    res.json({ count: bookings.length, bookings });
  } catch (error) {
    console.error('Get my rentals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/bookings/my-bookings - Get bookings as owner
router.get('/my-bookings', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.userId; // Fixed: use req.userId
    
    let query = { owner: userId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('equipment', 'name type brand model')
      .populate('renter', 'name phone village')
      .sort({ createdAt: -1 });

    res.json({ count: bookings.length, bookings });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH /api/bookings/:id/confirm - Confirm booking (owner only)
router.patch('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId; // Fixed: use req.userId
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only owner can confirm booking' });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Booking cannot be confirmed' });
    }

    booking.status = 'confirmed';
    await booking.save();
    
    res.json({ message: 'Booking confirmed', booking });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH /api/bookings/:id/complete - Complete booking
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId; // Fixed: use req.userId
    const booking = await Booking.findById(req.params.id).populate('equipment');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isOwner = booking.owner.toString() === userId.toString();
    const isRenter = booking.renter.toString() === userId.toString();
    
    if (!isOwner && !isRenter) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    const equipment = await Equipment.findById(booking.equipment._id);
    equipment.status = 'available';
    equipment.currentBooking = null;
    await equipment.save();

    res.json({ message: 'Booking completed successfully', booking });
  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH /api/bookings/:id/cancel - Cancel booking
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.userId; // Fixed: use req.userId
    const booking = await Booking.findById(req.params.id).populate('equipment');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isOwner = booking.owner.toString() === userId.toString();
    const isRenter = booking.renter.toString() === userId.toString();
    
    if (!isOwner && !isRenter) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = userId;
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    await booking.save();

    const equipment = await Equipment.findById(booking.equipment._id);
    equipment.status = 'available';
    equipment.currentBooking = null;
    await equipment.save();

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;