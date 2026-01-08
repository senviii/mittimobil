const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Farmer = require('../models/Farmer');

const router = express.Router();

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('village').notEmpty().withMessage('Village is required'),
  body('panchayat').notEmpty().withMessage('Panchayat is required'),
  body('district').notEmpty().withMessage('District is required'),
  body('state').notEmpty().withMessage('State is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, password, village, panchayat, district, state, location, landSize, language } = req.body;

    let farmer = await Farmer.findOne({ phone });
    if (farmer) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    farmer = new Farmer({
      name, phone, password, village, panchayat, district, state,
      location: location || { type: 'Point', coordinates: [0, 0] },
      landSize, language: language || 'hindi'
    });

    await farmer.save();

    const token = jwt.sign(
      { id: farmer._id, phone: farmer.phone },
      process.env.JWT_SECRET || 'mittimobil_secret_key',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      farmer: { id: farmer._id, name: farmer.name, phone: farmer.phone, village: farmer.village }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', [
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;
    const farmer = await Farmer.findOne({ phone }).select('+password');
    if (!farmer) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await farmer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: farmer._id, phone: farmer.phone },
      process.env.JWT_SECRET || 'mittimobil_secret_key',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      farmer: { id: farmer._id, name: farmer.name, phone: farmer.phone, village: farmer.village }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
