const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics (Admin only)
// @access  Private/Admin
router.get('/stats', [auth, admin], async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get active users (users who are not explicitly inactive)
    const activeUsers = await User.countDocuments({ 
      $or: [
        { isActive: { $ne: false } },
        { isActive: { $exists: false } }
      ]
    });
    
    // Get total products
    const totalProducts = await Product.countDocuments();
    
    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsersCount = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Calculate user growth percentage (mock calculation)
    const userGrowthPercentage = totalUsers > 0 ? ((recentUsersCount / totalUsers) * 100).toFixed(1) : 0;
    
    // Mock data for orders and revenue (since we don't have order model yet)
    const mockOrdersData = {
      totalOrders: Math.floor(totalUsers * 0.7), // Assume 70% of users have made orders
      totalRevenue: Math.floor(totalUsers * 150), // Average $150 per user
      recentOrders: Math.floor(recentUsersCount * 0.8) // 80% of recent users made orders
    };
    
    const stats = {
      totalUsers,
      activeUsers,
      totalProducts,
      totalOrders: mockOrdersData.totalOrders,
      totalRevenue: mockOrdersData.totalRevenue,
      conversionRate: ((mockOrdersData.totalOrders / totalUsers) * 100).toFixed(1),
      userGrowthPercentage: parseFloat(userGrowthPercentage),
      productGrowthPercentage: 12.1, // Mock data
      orderGrowthPercentage: 15.3, // Mock data
      revenueGrowthPercentage: 22.4, // Mock data
      lowStockItems: Math.floor(totalProducts * 0.1) || 3 // 10% of products are low stock
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/recent-users
// @desc    Get recent users (Admin only)
// @access  Private/Admin
router.get('/recent-users', [auth, admin], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // Format the data for frontend
    const formattedUsers = recentUsers.map(user => ({
      id: user._id,
      name: user.name || 'No Name',
      email: user.email,
      joinDate: user.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
      status: user.isActive !== false ? 'Active' : 'Inactive',
      role: user.role || 'user'
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity (Admin only)
// @access  Private/Admin
router.get('/recent-activity', [auth, admin], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Get recent user registrations
    const recentUsers = await User.find()
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // Format activity data
    const activities = recentUsers.map(user => ({
      id: `user_${user._id}`,
      type: 'user_registration',
      description: `New user registered: ${user.email}`,
      user: user.name || user.email,
      timestamp: user.createdAt,
      time: getRelativeTime(user.createdAt)
    }));
    
    // Sort by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(activities.slice(0, limit));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/user-analytics
// @desc    Get user analytics data (Admin only)
// @access  Private/Admin
router.get('/user-analytics', [auth, admin], async (req, res) => {
  try {
    // Get user registration data for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyRegistrations = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const count = await User.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      dailyRegistrations.push({
        date: startOfDay.toISOString().split('T')[0],
        count
      });
    }
    
    // Get user role distribution
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = await User.countDocuments({ 
      $or: [
        { role: 'user' },
        { role: { $exists: false } }
      ]
    });
    
    const roleDistribution = {
      admin: adminCount,
      user: userCount
    };
    
    // Get user status distribution
    const activeCount = await User.countDocuments({ 
      $or: [
        { isActive: { $ne: false } },
        { isActive: { $exists: false } }
      ]
    });
    const inactiveCount = await User.countDocuments({ isActive: false });
    
    const statusDistribution = {
      active: activeCount,
      inactive: inactiveCount
    };
    
    res.json({
      dailyRegistrations,
      roleDistribution,
      statusDistribution
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get relative time
function getRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

module.exports = router;
