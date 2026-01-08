const mongoose = require('mongoose');
const Equipment = require('./models/Equipment');
require('dotenv').config();

const locationMap = {
  'Thane': [72.9781, 19.2183],
  'Kalyan': [73.1631, 19.2403],
  'Pune': [73.8567, 18.5204],
  'Mumbai': [72.8777, 19.0760],
  'Raigad': [73.0068, 18.8350],
  'Medak': [78.0322, 17.7134],
  'srm nagar': [80.0498, 12.8230],
  'chengalpattu': [79.9753, 12.6919]
};

async function updateLocations() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const equipment = await Equipment.find({});
    console.log(`Found ${equipment.length} equipment to update`);
    
    for (let eq of equipment) {
      let district = (eq.district || eq.location?.district || 'Mumbai').trim().toLowerCase();
      
      // Find matching coordinates
      let coords = null;
      for (const [key, value] of Object.entries(locationMap)) {
        if (district.includes(key.toLowerCase())) {
          coords = value;
          break;
        }
      }
      
      if (!coords) coords = locationMap['Mumbai'];
      
      eq.location = {
        type: 'Point',
        coordinates: coords,
        village: eq.village,
        district: eq.district,
        state: eq.state || 'Maharashtra'
      };
      
      // Also fix availability
      eq.available = true;
      
      await eq.save();
      console.log(`✅ Updated ${eq.name} in ${eq.district}: [${coords}]`);
    }
    
    console.log('✅ All equipment updated!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateLocations();