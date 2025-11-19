const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Regular Register
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    const { name, email, password, role } = req.body;
    
    // Validation
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required',
        field: !email ? 'email' : 'password'
      });
    }

    if (password.length < 6) {
      console.log('Password too short');
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long',
        field: 'password'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email',
        field: 'email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name: name || email.split('@')[0], // Use email prefix as name if not provided
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'user'
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.email);

    // Return response
    console.log('User registered successfully:', user.email);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Google Register
router.post('/google-register', async (req, res) => {
  try {
    const { email, name, googleId, picture } = req.body;
    
    // Validation
    if (!email || !googleId) {
      return res.status(400).json({ message: 'Email and Google ID are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      // User exists, update with Google info if needed and login
      if (!user.googleId) {
        user.googleId = googleId;
        user.picture = picture;
        await user.save();
      }

      const token = generateToken(user._id, user.email);

      return res.json({
        message: 'Login successful',
        token,
        user: user.getPublicProfile()
      });
    }

    // Create new user for Google signup
    user = new User({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: await bcrypt.hash(googleId + Date.now(), 12), // Generate a password
      googleId,
      picture,
      role: 'user'
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.email);

    res.status(201).json({
      message: 'Google signup successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Google register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Regular Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body);
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required',
        field: !email ? 'email' : 'password'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email or password',
        field: 'email'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('Account deactivated:', email);
      return res.status(403).json({ 
        success: false,
        message: 'Account is deactivated. Please contact support.',
        field: 'account'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email or password',
        field: 'password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token with user role
    const token = generateToken(user._id, user.email);

    console.log('Login successful for user:', user.email, 'Role:', user.role);
    res.json({
      success: true,
      message: 'Login successful',
      role: user.role,
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Google Login
router.post('/google-login', async (req, res) => {
  try {
    const { email, name, googleId, picture } = req.body;
    
    // Validation
    if (!email || !googleId) {
      return res.status(400).json({ message: 'Email and Google ID are required' });
    }

    // Find user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: await bcrypt.hash(googleId + Date.now(), 12),
        googleId,
        picture,
        role: 'user'
      });
      await user.save();
    } else {
      // Update Google info if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.picture = picture;
      }
      user.lastLogin = new Date();
      await user.save();
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Generate token
    const token = generateToken(user._id, user.email);

    res.json({
      message: 'Google login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user (protected route)
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: user.getPublicProfile() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new token
    const newToken = generateToken(user._id, user.email);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Test route to verify API connection
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working correctly!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route to verify current user and role
router.get('/verify-admin', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const User = require('../models/User');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User verified',
      userData: {
        id: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.role === 'admin',
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Token verification failed', 
      error: error.message 
    });
  }
});

module.exports = router;