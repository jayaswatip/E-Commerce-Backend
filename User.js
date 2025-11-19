const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  googleId: { 
    type: String,
    sparse: true // Allows multiple null values but enforces uniqueness for non-null values
  },
  picture: { 
    type: String 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, { 
  timestamps: true 
});

// Indexes are derived from field definitions (unique/sparse) to avoid duplicates

// Pre-save middleware to update lastLogin
userSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('lastLogin')) {
    this.lastLogin = new Date();
  }
  next();
});

// Instance method to get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    picture: this.picture,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);