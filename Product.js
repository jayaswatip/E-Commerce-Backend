const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String,
    trim: true,
    maxlength: 500
  },
  helpful: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0
  },
  category: { 
    type: String, 
    required: true,
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  images: [{
    url: { type: String, required: true },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],
  image: { 
    type: String // Keep for backward compatibility
  },
  stock: { 
    type: Number, 
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  rating: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  reviews: [reviewSchema],
  tags: [{
    type: String,
    trim: true
  }],
  specifications: {
    type: Map,
    of: String
  },
  dimensions: {
    weight: { type: Number },
    length: { type: Number },
    width: { type: Number },
    height: { type: Number }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  seoTitle: {
    type: String,
    trim: true
  },
  seoDescription: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes for better performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isFeatured: -1, createdAt: -1 });
productSchema.index({ isActive: 1 });

// Pre-save middleware to calculate rating
productSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = Math.round((totalRating / this.reviews.length) * 10) / 10; // Round to 1 decimal
    this.reviewCount = this.reviews.length;
  } else {
    this.rating = 0;
    this.reviewCount = 0;
  }
  next();
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'out-of-stock';
  if (this.stock <= this.lowStockThreshold) return 'low-stock';
  return 'in-stock';
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }
  return 0;
});

// Instance method to add review
productSchema.methods.addReview = function(userId, rating, comment) {
  // Remove existing review from same user
  this.reviews = this.reviews.filter(review => !review.user.equals(userId));
  
  // Add new review
  this.reviews.push({
    user: userId,
    rating,
    comment: comment || ''
  });
  
  return this.save();
};

// Instance method to get public data
productSchema.methods.getPublicData = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    price: this.price,
    comparePrice: this.comparePrice,
    category: this.category,
    subcategory: this.subcategory,
    brand: this.brand,
    images: this.images,
    image: this.image, // backward compatibility
    stock: this.stock,
    stockStatus: this.stockStatus,
    rating: this.rating,
    reviewCount: this.reviewCount,
    tags: this.tags,
    isFeatured: this.isFeatured,
    discountPercentage: this.discountPercentage,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to get featured products
productSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to search products
productSchema.statics.searchProducts = function(query, filters = {}) {
  const searchQuery = { isActive: true };
  
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  if (filters.category) {
    searchQuery.category = filters.category;
  }
  
  if (filters.subcategory) {
    searchQuery.subcategory = filters.subcategory;
  }
  
  if (filters.minPrice || filters.maxPrice) {
    searchQuery.price = {};
    if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
    if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
  }
  
  if (filters.inStock) {
    searchQuery.stock = { $gt: 0 };
  }
  
  const sortOptions = {};
  switch (filters.sortBy) {
    case 'price-low':
      sortOptions.price = 1;
      break;
    case 'price-high':
      sortOptions.price = -1;
      break;
    case 'rating':
      sortOptions.rating = -1;
      break;
    case 'newest':
      sortOptions.createdAt = -1;
      break;
    default:
      if (query) {
        sortOptions.score = { $meta: 'textScore' };
      } else {
        sortOptions.createdAt = -1;
      }
  }
  
  return this.find(searchQuery).sort(sortOptions);
};

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);