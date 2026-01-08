// fixEverything.js - Fix locations and availability
const mongoose = require('mongoose');
const Equipment = require('./models/Equipment');
require('dotenv').config();

const locationMap = {
  'thane': { coords: [72.9781, 19.2183], state: 'Maharashtra' },
  'kalyan': { coords: [73.1631, 19.2403], state: 'Maharashtra' },
  'pune': { coords: [73.8567, 18.5204], state: 'Maharashtra' },
  'mumbai': { coords: [72.8777, 19.0760], state: 'Maharashtra' },
  'navi mumbai': { coords: [73.0297, 19.0330], state: 'Maharashtra' },
  'panvel': { coords: [73.1129, 18.9894], state: 'Maharashtra' },
  'raigad': { coords: [73.0068, 18.8350], state: 'Maharashtra' },
  'medak': { coords: [78.0322, 17.7134], state: 'Telangana' },
  'srm nagar': { coords: [80.0498, 12.8230], state: 'Tamil Nadu' },
  'chengalpattu': { coords: [79.9753, 12.6919], state: 'Tamil Nadu' },
  'rampur': { coords: [73.8567, 18.5204], state: 'Maharashtra' } // Near Pune
};

function findCoordinates(district, village) {
  if (!district && !village) return locationMap['mumbai'];
  
  const searchText = `${district || ''} ${village || ''}`.toLowerCase().trim();
  
  // Try exact match first
  for (const [key, value] of Object.entries(locationMap)) {
    if (searchText === key || searchText.includes(key) || key.includes(searchText)) {
      return value;
    }
  }
  
  return locationMap['mumbai']; // Default to Mumbai
}

async function fixEverything() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const equipment = await Equipment.find({});
    console.log(`📦 Found ${equipment.length} equipment to fix\n`);
    console.log('━'.repeat(60));
    
    let updated = 0;
    
    for (let eq of equipment) {
      const district = eq.district || eq.location?.district;
      const village = eq.village || eq.location?.village;
      const locationData = findCoordinates(district, village);
      
      // Update location with proper coordinates
      eq.location = {
        type: 'Point',
        coordinates: locationData.coords, // [longitude, latitude]
        village: village,
        district: district,
        state: eq.state || locationData.state
      };
      
      // Fix availability
      eq.available = true;
      
      // Remove old status field
      eq.status = undefined;
      
      await eq.save();
      updated++;
      
      console.log(`✅ ${updated}. ${eq.name}`);
      console.log(`   📍 Location: ${village}, ${district}`);
      console.log(`   🌍 Coordinates: [${locationData.coords[0]}, ${locationData.coords[1]}]`);
      console.log(`   ✓ Available: ${eq.available}`);
      console.log('━'.repeat(60));
    }
    
    console.log(`\n🎉 Successfully updated ${updated} equipment!`);
    console.log('\n📍 Test Location Searches:');
    console.log('━'.repeat(60));
    console.log('1. "Kalyan, Thane" → lat=19.2403, lng=73.1631, radius=20');
    console.log('2. "Mumbai, Maharashtra" → lat=19.0760, lng=72.8777, radius=30');
    console.log('3. "Thane" → lat=19.2183, lng=72.9781, radius=15');
    console.log('4. "Pune" → lat=18.5204, lng=73.8567, radius=25');
    console.log('━'.repeat(60));
    
    console.log('\n🧪 Test Commands:');
    console.log('Invoke-RestMethod -Uri "http://localhost:5000/api/location/nearby?lat=19.2403&lng=73.1631&radius=20"');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixEverything();