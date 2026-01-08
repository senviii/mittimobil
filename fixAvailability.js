// fixAvailability.js - Run once to fix availability field
const mongoose = require('mongoose');
const Equipment = require('./models/Equipment');
require('dotenv').config();

async function fixAvailability() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const equipment = await Equipment.find({});
    console.log(`Found ${equipment.length} equipment to update`);
    
    for (let eq of equipment) {
      // Set available to true if status is "available" OR if available is undefined
      eq.available = eq.status === 'available' || eq.available === true || true;
      
      // Remove status field if it exists
      if (eq.status) {
        eq.status = undefined;
      }
      
      await eq.save();
      console.log(`✅ Updated ${eq.name} - available: ${eq.available}`);
    }
    
    console.log('✅ All equipment availability updated!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAvailability();