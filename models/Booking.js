const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  renter: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: {
    hours: { type: Number, default: 0 },
    days: { type: Number, default: 0 }
  },
  pricePerUnit: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'partial', 'completed', 'refunded'], default: 'pending' },
  deliveryLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    address: String
  },
  deliveryType: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
  notes: { type: String, maxlength: 500 },
  renterRating: { type: Number, min: 0, max: 5 },
  ownerRating: { type: Number, min: 0, max: 5 },
  renterReview: String,
  ownerReview: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
  cancellationReason: String,
  completedAt: Date,
  cancelledAt: Date
}, { timestamps: true });

bookingSchema.index({ equipment: 1, status: 1 });
bookingSchema.index({ renter: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
