// services/openStreetMap.js
// OpenStreetMap/Nominatim integration - Completely FREE, no credit card needed!

const axios = require('axios');

class OpenStreetMapService {
  constructor() {
    this.nominatimUrl = 'https://nominatim.openstreetmap.org';
    // Set a user agent (required by Nominatim)
    this.userAgent = 'MittiMobil/1.0 (Agricultural Equipment Sharing Platform)';
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Find equipment within radius
  async findEquipmentNearby(userLat, userLon, radius, Equipment) {
    try {
      // Get all available equipment
      const allEquipment = await Equipment.find({ available: true })
        .populate('owner', 'name phone');

      // Calculate distances and filter by radius
      const nearbyEquipment = allEquipment
        .map(equipment => {
          if (!equipment.location?.coordinates) return null;

          const [equipLon, equipLat] = equipment.location.coordinates;
          const distance = this.calculateDistance(userLat, userLon, equipLat, equipLon);

          if (distance <= radius) {
            return {
              ...equipment.toObject(),
              distance: Math.round(distance * 10) / 10 // Round to 1 decimal
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);

      return nearbyEquipment;
    } catch (error) {
      console.error('Find nearby equipment error:', error);
      throw error;
    }
  }

  // Geocode address to coordinates
  async geocodeAddress(address) {
    try {
      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          addressdetails: 1,
          limit: 1,
          countrycodes: 'in' // Restrict to India
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('Address not found');
      }

      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: result.display_name,
        placeId: result.place_id,
        address: {
          village: result.address.village,
          city: result.address.city || result.address.town,
          state: result.address.state,
          country: result.address.country,
          postcode: result.address.postcode
        }
      };
    } catch (error) {
      console.error('Geocode error:', error.message);
      throw new Error('Failed to geocode address');
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(`${this.nominatimUrl}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.data) {
        throw new Error('Location not found');
      }

      const result = response.data;
      return {
        formattedAddress: result.display_name,
        city: result.address.city || result.address.town || result.address.village,
        state: result.address.state,
        country: result.address.country,
        postalCode: result.address.postcode,
        placeId: result.place_id
      };
    } catch (error) {
      console.error('Reverse geocode error:', error.message);
      throw new Error('Failed to reverse geocode location');
    }
  }

  // Search for places (villages, cities)
  async searchPlaces(query, lat = null, lng = null) {
    try {
      const params = {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 10,
        countrycodes: 'in'
      };

      // If coordinates provided, bias search to that location
      if (lat && lng) {
        params.viewbox = `${lng - 0.5},${lat - 0.5},${lng + 0.5},${lat + 0.5}`;
        params.bounded = 0; // Don't strictly bound, just bias
      }

      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params,
        headers: {
          'User-Agent': this.userAgent
        }
      });

      return response.data.map(place => ({
        name: place.display_name,
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        type: place.type,
        placeId: place.place_id,
        address: {
          village: place.address.village,
          city: place.address.city || place.address.town,
          state: place.address.state
        }
      }));
    } catch (error) {
      console.error('Search places error:', error.message);
      return [];
    }
  }

  // Get route distance estimation (straight line - for simple distance)
  async getDistanceEstimate(originLat, originLng, destLat, destLng) {
    const distance = this.calculateDistance(originLat, originLng, destLat, destLng);
    
    // Estimate travel time (assuming 40 km/h average speed on rural roads)
    const averageSpeed = 40; // km/h
    const durationHours = distance / averageSpeed;
    const durationMinutes = Math.round(durationHours * 60);

    return {
      distance: {
        value: distance * 1000, // in meters
        text: `${distance.toFixed(1)} km`
      },
      duration: {
        value: durationMinutes * 60, // in seconds
        text: durationMinutes < 60 
          ? `${durationMinutes} mins` 
          : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
      }
    };
  }

  // Find nearby places within radius
  async findNearbyPlaces(lat, lng, radius = 5) {
    try {
      // Search for places around the coordinates
      const response = await axios.get(`${this.nominatimUrl}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1,
          zoom: 10 // Zoom level affects detail
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.data) return [];

      return [{
        name: response.data.address.city || response.data.address.town || response.data.address.village,
        vicinity: response.data.display_name,
        location: {
          lat: parseFloat(response.data.lat),
          lng: parseFloat(response.data.lon)
        }
      }];
    } catch (error) {
      console.error('Nearby places error:', error.message);
      return [];
    }
  }

  // Address autocomplete
  async autocompleteAddress(input) {
    try {
      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params: {
          q: input,
          format: 'json',
          addressdetails: 1,
          limit: 5,
          countrycodes: 'in'
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      return response.data.map(prediction => ({
        description: prediction.display_name,
        placeId: prediction.place_id,
        mainText: prediction.address.city || prediction.address.town || prediction.address.village,
        secondaryText: `${prediction.address.state}, ${prediction.address.country}`
      }));
    } catch (error) {
      console.error('Autocomplete error:', error.message);
      throw new Error('Failed to autocomplete address');
    }
  }

  // Get place details from coordinates
  async getPlaceDetails(lat, lng) {
    try {
      return await this.reverseGeocode(lat, lng);
    } catch (error) {
      console.error('Place details error:', error.message);
      throw new Error('Failed to get place details');
    }
  }

  // Batch geocode multiple addresses
  async batchGeocode(addresses) {
    const results = [];
    
    for (const address of addresses) {
      try {
        // Add delay to respect Nominatim's rate limit (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await this.geocodeAddress(address);
        results.push({ address, ...result, success: true });
      } catch (error) {
        results.push({ address, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = new OpenStreetMapService();