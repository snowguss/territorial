const MAPS_API_KEY = typeof process !== 'undefined' && process.env && process.env.MAPS_API_KEY 
  ? process.env.MAPS_API_KEY 
  : window.NETLIFY_ENV?.MAPS_API_KEY || '';
