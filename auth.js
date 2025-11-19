const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      console.log('✗ No Authorization header');
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    console.log('✓ Token decoded:', { userId: decoded.userId, email: decoded.email });
    
    // Fetch user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('✗ User not found in database:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }
    
    console.log('✓ User found:', { id: user._id, email: user.email, role: user.role });
    
    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    console.log('✗ Auth error:', error.message);
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
};