const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const farmerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
  password: { type: String, required: true, minlength: 6, select: false },
  village: { type: String, required: true },
  panchayat: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  landSize: { type: Number, default: 0 },
  isEquipmentOwner: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  language: { type: String, enum: ['hindi', 'english', 'tamil', 'telugu', 'marathi', 'punjabi'], default: 'hindi' }
}, { timestamps: true });

farmerSchema.index({ location: '2dsphere' });

farmerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

farmerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Farmer', farmerSchema);
