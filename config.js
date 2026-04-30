require("dotenv").config();

module.exports = {
  token: process.env.token,
  clientId: process.env.clientId,
  geniusAccessToken: process.env.GENIUS_ACCESS_TOKEN,
  embedColor: "#1DB954",
  defaultVolume: 100,
  maxQueueSize: 100,
  disconnectTimeout: 30000, // ms before leaving empty VC
};
