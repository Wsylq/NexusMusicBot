require("dotenv").config();

module.exports = {
  token: process.env.token,
  clientId: process.env.clientId,
  geniusAccessToken: process.env.GENIUS_ACCESS_TOKEN,
  embedColor: "#1DB954",
  defaultVolume: 100,
  maxQueueSize: 100,
  disconnectTimeout: 30000,
  lavalink: {
    host: process.env.LAVALINK_HOST || "localhost",
    port: parseInt(process.env.LAVALINK_PORT) || 2333,
    password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
    secure: process.env.LAVALINK_SECURE === "true",
  },
};
