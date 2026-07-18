const CITIES = {
  'hyderabad': { lat: 17.3850, lon: 78.4867 },
  'mumbai':    { lat: 19.0760, lon: 72.8777 },
  'delhi':     { lat: 28.7041, lon: 77.1025 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'chennai':   { lat: 13.0827, lon: 80.2707 },
  'kolkata':   { lat: 22.5726, lon: 88.3639 },
  'pune':      { lat: 18.5204, lon: 73.8567 },
  'london':    { lat: 51.5074, lon: -0.1278 },
  'new york':  { lat: 40.7128, lon: -74.0060 }
};

export const weatherToolDefinitions = [{
  name: 'get_current_weather',
  description: 'Get current weather for a city.',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string', description: 'City name' } },
    required: ['city']
  }
}];

export const weatherToolExecutors = {
  get_current_weather: async ({ city }) => {
    const key    = city.toLowerCase().trim();
    const coords = CITIES[key];
    if (!coords) return {
      success: false,
      error: `City "${city}" not found. Try: ${Object.keys(CITIES).join(', ')}`
    };
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
      const res  = await fetch(url);
      const data = await res.json();
      const c    = data.current;
      const codes = { 0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast', 51:'Drizzle', 61:'Rain', 80:'Showers', 95:'Thunderstorm' };
      return {
        success: true, city,
        temperature: `${c.temperature_2m}°C`,
        humidity:    `${c.relative_humidity_2m}%`,
        wind:        `${c.wind_speed_10m} km/h`,
        condition:   codes[c.weather_code] || 'Unknown',
        umbrella:    [51,61,63,65,80,95].includes(c.weather_code)
      };
    } catch (e) { return { success: false, error: e.message }; }
  }
};