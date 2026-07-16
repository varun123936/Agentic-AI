// Weather tool — uses Open-Meteo (100% free, no API key needed)
// Great for demonstrating tool calling with a real external API

export const weatherToolDefinitions = [
  {
    name: 'get_current_weather',
    description: `Get the current weather for any city.
Use this when a user asks about weather conditions,
temperature, or if they should carry an umbrella.`,
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g. Hyderabad, Mumbai, Delhi)'
        }
      },
      required: ['city']
    }
  }
];

// City coordinates map — Open-Meteo needs lat/lon
const CITY_COORDINATES = {
  'hyderabad': { lat: 17.3850, lon: 78.4867 },
  'mumbai':    { lat: 19.0760, lon: 72.8777 },
  'delhi':     { lat: 28.7041, lon: 77.1025 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'chennai':   { lat: 13.0827, lon: 80.2707 },
  'kolkata':   { lat: 22.5726, lon: 88.3639 },
  'pune':      { lat: 18.5204, lon: 73.8567 },
  'london':    { lat: 51.5074, lon: -0.1278 },
  'new york':  { lat: 40.7128, lon: -74.0060 },
  'tokyo':     { lat: 35.6762, lon: 139.6503 }
};

export const weatherToolExecutors = {

  get_current_weather: async ({ city }) => {
    try {
      const cityKey = city.toLowerCase().trim();
      const coords = CITY_COORDINATES[cityKey];

      if (!coords) {
        return {
          success: false,
          error: `City "${city}" not in our database. Try: Hyderabad, Mumbai, Delhi, Bangalore, Chennai.`
        };
      }

      // Open-Meteo — completely free, no API key
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.current) {
        return { success: false, error: 'Weather data unavailable' };
      }

      const weatherCodes = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy',
        3: 'Overcast', 45: 'Foggy', 48: 'Depositing rime fog',
        51: 'Light drizzle', 61: 'Slight rain', 63: 'Moderate rain',
        65: 'Heavy rain', 71: 'Slight snow', 80: 'Slight rain showers',
        95: 'Thunderstorm'
      };

      const current = data.current;
      const condition = weatherCodes[current.weather_code] || 'Unknown';

      return {
        success: true,
        city: city,
        temperature: `${current.temperature_2m}°C`,
        humidity: `${current.relative_humidity_2m}%`,
        windSpeed: `${current.wind_speed_10m} km/h`,
        condition,
        umbrella: [51, 61, 63, 65, 80, 95].includes(current.weather_code),
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      };

    } catch (error) {
      return {
        success: false,
        error: `Weather fetch failed: ${error.message}`
      };
    }
  }
};