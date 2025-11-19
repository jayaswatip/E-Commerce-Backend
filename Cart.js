const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    required: true
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: { 
    type: Number, 
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  couponCode: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Indexes are derived from field definitions (unique) and usage; avoid duplicates
cartSchema.index({ 'items.productId': 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  // Calculate subtotal and total items
  this.subtotal = 0;
  this.totalItems = 0;

  this.items.forEach(item => {
    item.totalPrice = item.price * item.quantity;
    this.subtotal += item.totalPrice;
    this.totalItems += item.quantity;
  });

  // Calculate total (subtotal + tax + shipping - discount)
  this.total = this.subtotal + this.tax + this.shipping - this.discount;
  
  // Ensure total is not negative
  if (this.total < 0) {
    this.total = 0;
  }

  // Update last modified
  this.lastModified = new Date();
  
  next();
});

// Instance method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity = 1, price) {
  // Check if item already exists
  const existingItemIndex = this.items.findIndex(
    item => item.productId.toString() === productId.toString()
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = price; // Update price in case it changed
  } else {
    // Add new item
    this.items.push({
      productId,
      quantity,
      price,
      totalPrice: price * quantity
    });
  }

  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity) {
  const itemIndex = this.items.findIndex(
    item => item.productId.toString() === productId.toString()
  );

  if (itemIndex >= 0) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      this.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      this.items[itemIndex].quantity = quantity;
    }
    return this.save();
  } else {
    throw new Error('Item not found in cart');
  }
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = async function(productId) {
  this.items = this.items.filter(
    item => item.productId.toString() !== productId.toString()
  );
  return this.save();
};

// Instance method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.couponCode = null;
  this.discount = 0;
  return this.save();
};

// Instance method to apply coupon
cartSchema.methods.applyCoupon = async function(couponCode, discountAmount) {
  this.couponCode = couponCode;
  this.discount = discountAmount;
  return this.save();
};

// Instance method to remove coupon
cartSchema.methods.removeCoupon = async function() {
  this.couponCode = null;
  this.discount = 0;
  return this.save();
};

// Instance method to get cart summary
cartSchema.methods.getSummary = function() {
  return {
    totalItems: this.totalItems,
    subtotal: this.subtotal,
    tax: this.tax,
    shipping: this.shipping,
    discount: this.discount,
    total: this.total,
    couponCode: this.couponCode
  };
};

// Static method to get or create cart for user
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ userId, isActive: true })
    .populate('items.productId', 'name price image stock');

  if (!cart) {
    cart = new this({
      userId,
      items: []
    });
    await cart.save();
  }

  return cart;
};

// Static method to get cart with populated products
cartSchema.statics.getCartWithProducts = async function(userId) {
  return this.findOne({ userId, isActive: true })
    .populate({
      path: 'items.productId',
      select: 'name price image images stock category isActive',
      match: { isActive: true }
    })
    .populate('userId', 'name email');
};

// Virtual for formatted total
cartSchema.virtual('formattedTotal').get(function() {
  return `${this.total.toFixed(2)}`;
});

// Virtual for formatted subtotal
cartSchema.virtual('formattedSubtotal').get(function() {
  return `${this.subtotal.toFixed(2)}`;
});

// Ensure virtual fields are serialized
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);