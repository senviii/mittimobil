const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE ===');
    console.log('Authorization header:', req.header('Authorization'));
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token found in request');
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    console.log('Token found:', token.substring(0, 20) + '...');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    // Handle different token structures
    req.userId = decoded.userId || decoded.id || decoded._id;
    req.userRole = decoded.role;
    
    console.log('Set userId:', req.userId);
    console.log('Set userRole:', req.userRole);
    
    if (!req.userId) {
      console.log('ERROR: userId not found in token payload');
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Please authenticate', details: error.message });
  }
};