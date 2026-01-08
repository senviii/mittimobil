// routes/location.js
// Location routes using FREE OpenStreetMap (No credit card needed!)

const express = require('express');
const router = express.Router();
const openStreetMap = require('../services/openStreetMap');
const Equipment = require('../models/Equipment');

// GET /api/location/nearby - Find equipment nearby
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        message: 'Latitude and longitude required' 
      });
    }

    const nearbyEquipment = await openStreetMap.findEquipmentNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      Equipment
    );

    res.json({
      count: nearbyEquipment.length,
      radius: `${radius} km`,
      equipment: nearbyEquipment
    });

  } catch (error) {
    console.error('Nearby equipment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/location/geocode - Convert address to coordinates
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: 'Address required' });
    }

    const result = await openStreetMap.geocodeAddress(address);

    res.json(result);

  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ 
      message: 'Failed to geocode address',
      error: error.message 
    });
  }
});

// POST /api/location/reverse-geocode - Convert coordinates to address
router.post('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ 
        message: 'Latitude and longitude required' 
      });
    }

    const result = await openStreetMap.reverseGeocode(
      parseFloat(lat),
      parseFloat(lng)
    );

    res.json(result);

  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({ 
      message: 'Failed to reverse geocode',
      error: error.message 
    });
  }
});

// POST /api/location/distance - Calculate distance between points
router.post('/distance', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ 
        message: 'Origin and destination coordinates required' 
      });
    }

    const result = await openStreetMap.getDistanceEstimate(
      parseFloat(originLat),
      parseFloat(originLng),
      parseFloat(destLat),
      parseFloat(destLng)
    );

    res.json(result);

  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({ 
      message: 'Failed to calculate distance',
      error: error.message 
    });
  }
});

// GET /api/location/search - Search for places
router.get('/search', async (req, res) => {
  try {
    const { query, lat, lng } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const places = await openStreetMap.searchPlaces(
      query,
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null
    );

    res.json({ places });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      message: 'Failed to search places',
      error: error.message 
    });
  }
});

// GET /api/location/autocomplete - Address autocomplete
router.get('/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;

    if (!input) {
      return res.status(400).json({ message: 'Search input required' });
    }

    const predictions = await openStreetMap.autocompleteAddress(input);

    res.json({ predictions });

  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ 
      message: 'Failed to autocomplete',
      error: error.message 
    });
  }
});

// GET /api/location/nearby-places - Find nearby villages/towns
router.get('/nearby-places', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        message: 'Latitude and longitude required' 
      });
    }

    const places = await openStreetMap.findNearbyPlaces(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius)
    );

    res.json({
      count: places.length,
      places
    });

  } catch (error) {
    console.error('Nearby places error:', error);
    res.status(500).json({ 
      message: 'Failed to find nearby places',
      error: error.message 
    });
  }
});

// POST /api/location/batch-geocode - Geocode multiple addresses
router.post('/batch-geocode', async (req, res) => {
  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ 
        message: 'Array of addresses required' 
      });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ 
        message: 'Maximum 10 addresses allowed per batch' 
      });
    }

    const results = await openStreetMap.batchGeocode(addresses);

    res.json({ results });

  } catch (error) {
    console.error('Batch geocode error:', error);
    res.status(500).json({ 
      message: 'Failed to batch geocode',
      error: error.message 
    });
  }
});

module.exports = router;