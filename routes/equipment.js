const express = require('express');
const { body, validationResult } = require('express-validator');
const Equipment = require('../models/Equipment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB limit per file
});

// GET /api/equipment - Get all available equipment with filters
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 50, type, minPrice, maxPrice, panchayat, district } = req.query;
    let query = { status: 'available' };

    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radius * 1000
        }
      };
    }

    if (type) query.type = type;
    if (minPrice || maxPrice) {
      query.pricePerHour = {};
      if (minPrice) query.pricePerHour.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerHour.$lte = parseFloat(maxPrice);
    }
    if (panchayat) query.panchayat = new RegExp(panchayat, 'i');
    if (district) query.district = new RegExp(district, 'i');

    const equipment = await Equipment.find(query)
      .populate('owner', 'name phone village rating')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ count: equipment.length, equipment });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/equipment/:id - Get single equipment by ID
router.get('/:id', async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id)
      .populate('owner', 'name phone village panchayat district rating');
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    res.json(equipment);
  } catch (error) {
    console.error('Get single equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/equipment - Create new equipment (requires auth)
// Accept any file field or no files at all
router.post('/', authMiddleware, upload.any(), async (req, res) => {
  try {
    console.log('=== ADD EQUIPMENT REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User ID from auth:', req.userId);
    console.log('User role from auth:', req.userRole);

    const { 
      name, type, brand, model, horsePower, yearOfPurchase,
      pricePerHour, pricePerDay, description, condition,
      district, panchayat, village
    } = req.body;

    // Validate required fields (description is now optional)
    if (!name || !type || !pricePerHour) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, type, pricePerHour' 
      });
    }

    // Get userId from auth middleware (it sets req.userId)
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
    }

    // Get farmer's location
    const Farmer = require('../models/Farmer');
    const farmer = await Farmer.findById(userId);

    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    console.log('Farmer found:', { 
      id: farmer._id, 
      name: farmer.name,
      district: farmer.district,
      panchayat: farmer.panchayat,
      village: farmer.village
    });

    const equipment = new Equipment({
      name,
      type,
      brand: brand || '',
      model: model || '',
      horsePower: horsePower || 0,
      yearOfPurchase: yearOfPurchase || new Date().getFullYear(),
      pricePerHour: parseFloat(pricePerHour),
      pricePerDay: pricePerDay ? parseFloat(pricePerDay) : 0,
      description,
      condition: condition || 'Good',
      available: true,
      status: 'available',
      owner: userId,
      district: district || farmer.district,
      panchayat: panchayat || farmer.panchayat,
      village: village || farmer.village,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760], // Default Mumbai coordinates
        village: village || farmer.village,
        district: district || farmer.district,
        state: farmer.state || 'Maharashtra'
      },
      imageUrl: ''
    });

    console.log('Equipment object created:', equipment);

    await equipment.save();

    console.log('Equipment saved successfully');

    res.status(201).json({
      message: 'Equipment added successfully',
      equipment
    });

  } catch (error) {
    console.error('=== ERROR ADDING EQUIPMENT ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error adding equipment', 
      error: error.message,
      details: error.toString()
    });
  }
});

// PUT /api/equipment/:id - Update equipment (requires auth and ownership)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    
    const userId = req.userId; // Fixed: use req.userId from auth middleware
    if (equipment.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updatedEquipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('owner', 'name phone village');

    res.json({ message: 'Equipment updated successfully', equipment: updatedEquipment });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/equipment/:id - Delete equipment (requires auth and ownership)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    
    const userId = req.userId; // Fixed: use req.userId from auth middleware
    if (equipment.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (equipment.status === 'booked') {
      return res.status(400).json({ message: 'Cannot delete equipment with active bookings' });
    }

    await Equipment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/equipment/my/equipment - Get owner's equipment (requires auth)
router.get('/my/equipment', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId; // Fixed: use req.userId from auth middleware
    const equipment = await Equipment.find({ owner: userId })
      .sort({ createdAt: -1 });

    res.json({ count: equipment.length, equipment });
  } catch (error) {
    console.error('Get my equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin route to fix availability (no auth for simplicity; secure in production)
router.get('/admin/fix-availability', async (req, res) => {
  try {
    const result = await Equipment.updateMany(
      {},
      { $set: { available: true, status: 'available' } }
    );
    res.json({ 
      message: 'All equipment set to available', 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error fixing availability:', error);
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;