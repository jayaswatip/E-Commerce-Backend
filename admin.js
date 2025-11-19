// Middleware to check if user is admin
const admin = (req, res, next) => {
  console.log('Admin middleware - checking user:', {
    exists: !!req.user,
    role: req.user?.role,
    email: req.user?.email
  });

  // Check if user exists and has admin role
  if (req.user && req.user.role === 'admin') {
    console.log('✓ Admin access granted');
    next();
  } else {
    console.log('✗ Admin access denied - User role:', req.user?.role);
    res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      userRole: req.user?.role 
    });
  }
};

module.exports = admin;
