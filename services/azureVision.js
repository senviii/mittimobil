// services/azureVision.js
// Azure Computer Vision Service for Equipment Photo Verification

const axios = require('axios');

class AzureVisionService {
  constructor() {
    this.key = process.env.AZURE_VISION_KEY;
    this.endpoint = process.env.AZURE_VISION_ENDPOINT;
    
    if (!this.key || !this.endpoint) {
      console.warn('Azure Vision credentials not configured');
    }
  }

  // Analyze equipment image for condition and details
  async analyzeEquipmentImage(imageUrl) {
    try {
      const analyzeUrl = `${this.endpoint}/vision/v3.2/analyze`;
      
      const response = await axios.post(
        analyzeUrl,
        { url: imageUrl },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.key,
            'Content-Type': 'application/json'
          },
          params: {
            visualFeatures: 'Categories,Description,Color,Tags,Objects',
            details: 'Landmarks',
            language: 'en'
          }
        }
      );

      return this.processAnalysisResults(response.data);
    } catch (error) {
      console.error('Azure Vision API Error:', error.response?.data || error.message);
      throw new Error('Failed to analyze equipment image');
    }
  }

  // Analyze equipment from uploaded file (base64)
  async analyzeEquipmentImageFromBuffer(imageBuffer) {
    try {
      const analyzeUrl = `${this.endpoint}/vision/v3.2/analyze`;
      
      const response = await axios.post(
        analyzeUrl,
        imageBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.key,
            'Content-Type': 'application/octet-stream'
          },
          params: {
            visualFeatures: 'Categories,Description,Color,Tags,Objects',
            details: 'Landmarks',
            language: 'en'
          }
        }
      );

      return this.processAnalysisResults(response.data);
    } catch (error) {
      console.error('Azure Vision API Error:', error.response?.data || error.message);
      throw new Error('Failed to analyze equipment image');
    }
  }

  // Process and structure the analysis results
  processAnalysisResults(data) {
    const equipmentKeywords = [
      'tractor', 'harvester', 'plow', 'plough', 'cultivator', 
      'seeder', 'sprayer', 'trailer', 'machinery', 'vehicle',
      'equipment', 'agricultural', 'farm', 'wheel', 'tire'
    ];

    // Extract equipment-related tags
    const equipmentTags = data.tags?.filter(tag => 
      equipmentKeywords.some(keyword => 
        tag.name.toLowerCase().includes(keyword)
      )
    ) || [];

    // Detect equipment type
    const detectedType = this.detectEquipmentType(data.tags || []);

    // Assess condition based on description and colors
    const condition = this.assessCondition(data);

    // Check if image contains equipment
    const isEquipment = equipmentTags.length > 0 || detectedType !== 'Unknown';

    return {
      isValidEquipment: isEquipment,
      detectedType,
      condition,
      confidence: data.tags?.[0]?.confidence || 0,
      description: data.description?.captions?.[0]?.text || 'No description available',
      tags: equipmentTags.map(tag => ({
        name: tag.name,
        confidence: tag.confidence
      })),
      colors: {
        dominant: data.color?.dominantColorForeground,
        accent: data.color?.accentColor,
        isBW: data.color?.isBWImg
      },
      objects: data.objects?.map(obj => ({
        name: obj.object,
        confidence: obj.confidence,
        rectangle: obj.rectangle
      })) || [],
      rawData: data
    };
  }

  // Detect equipment type from tags
  detectEquipmentType(tags) {
    const typeMapping = {
      tractor: ['tractor', 'farm tractor'],
      harvester: ['harvester', 'combine', 'thresher'],
      plough: ['plow', 'plough', 'cultivator'],
      seeder: ['seeder', 'planter', 'drill'],
      sprayer: ['sprayer', 'spray'],
      trailer: ['trailer', 'cart', 'wagon'],
      tiller: ['tiller', 'rotavator']
    };

    for (const [type, keywords] of Object.entries(typeMapping)) {
      for (const tag of tags) {
        if (keywords.some(keyword => tag.name.toLowerCase().includes(keyword))) {
          return type.charAt(0).toUpperCase() + type.slice(1);
        }
      }
    }

    return 'Unknown';
  }

  // Assess equipment condition
  assessCondition(data) {
    const description = data.description?.captions?.[0]?.text?.toLowerCase() || '';
    const tags = data.tags?.map(t => t.name.toLowerCase()) || [];
    
    // Check for condition indicators
    const goodIndicators = ['new', 'clean', 'shiny', 'maintained', 'polished'];
    const poorIndicators = ['old', 'rust', 'damaged', 'worn', 'broken', 'dirty'];

    const hasGoodIndicators = [...tags, description].some(text =>
      goodIndicators.some(indicator => text.includes(indicator))
    );

    const hasPoorIndicators = [...tags, description].some(text =>
      poorIndicators.some(indicator => text.includes(indicator))
    );

    if (hasGoodIndicators && !hasPoorIndicators) return 'Excellent';
    if (hasPoorIndicators) return 'Fair';
    return 'Good';
  }

  // Verify equipment authenticity (detect if image is real equipment vs screenshot/fake)
  async verifyEquipmentAuthenticity(imageUrl) {
    try {
      const analysis = await this.analyzeEquipmentImage(imageUrl);
      
      // Check if it's a real photo vs digital/screenshot
      const isAuthentic = !analysis.rawData.categories?.some(cat => 
        cat.name.includes('abstract') || cat.name.includes('clipart')
      );

      return {
        isAuthentic,
        confidence: analysis.confidence,
        reason: isAuthentic ? 'Real equipment photo' : 'May be a digital image or screenshot'
      };
    } catch (error) {
      throw new Error('Failed to verify equipment authenticity');
    }
  }

  // OCR - Read text from equipment (for serial numbers, model numbers)
  async readEquipmentText(imageUrl) {
    try {
      const ocrUrl = `${this.endpoint}/vision/v3.2/read/analyze`;
      
      const response = await axios.post(
        ocrUrl,
        { url: imageUrl },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.key,
            'Content-Type': 'application/json'
          }
        }
      );

      const operationLocation = response.headers['operation-location'];
      
      // Poll for results
      let result;
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const resultResponse = await axios.get(operationLocation, {
          headers: { 'Ocp-Apim-Subscription-Key': this.key }
        });
        
        if (resultResponse.data.status === 'succeeded') {
          result = resultResponse.data;
          break;
        }
        attempts++;
      }

      if (!result) throw new Error('OCR timeout');

      const extractedText = result.analyzeResult.readResults
        .flatMap(page => page.lines)
        .map(line => line.text)
        .join(' ');

      return {
        text: extractedText,
        lines: result.analyzeResult.readResults.flatMap(page => page.lines)
      };
    } catch (error) {
      console.error('OCR Error:', error.message);
      throw new Error('Failed to read text from image');
    }
  }
}

module.exports = new AzureVisionService();
