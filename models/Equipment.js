const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  name: { type: String, required: true },
  type: {
  type: String,
  enum: ['tractor', 'harvester', 'plow', 'tiller', 'thresher', 'sprayer', 'seeder', 'other'],  // This is the list of allowed values
  required: false
},
  brand: String,
  model: String,
  horsePower: Number,
  yearOfPurchase: Number,
  pricePerHour: { type: Number, required: true },
  pricePerDay: Number,
  description: { type: String, maxlength: 500 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  village: { type: String, required: true },
  panchayat: { type: String, required: true },
  district: { type: String, required: true },
  status: { type: String, enum: ['available', 'booked', 'maintenance', 'unavailable'], default: 'available' },
  currentBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  images: [String],
  features: [String],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalBookings: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

equipmentSchema.index({ location: '2dsphere' });
equipmentSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);
