require("dotenv").config();

module.exports = {
  token: process.env.token,
  clientId: process.env.clientId,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  geniusAccessToken: process.env.GENIUS_ACCESS_TOKEN,
  embedColor: "#1DB954",         // Spotify green
  defaultVolume: 100,
  maxQueueSize: 100,
  disconnectTimeout: 30000,      // ms before leaving empty VC
};
