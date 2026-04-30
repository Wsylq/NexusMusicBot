const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");
const SpotifyWebApi = require("spotify-web-api-node");
const scdl = require("soundcloud-downloader").default;
const config = require("../config");

class Bot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
    });

    /** @type {Collection<string, object>} */
    this.commands = new Collection();

    /** @type {Map<string, import("./MusicQueue")>} */
    this.queues = new Map();

    // Spotify API client
    this.spotify = new SpotifyWebApi({
      clientId: config.spotifyClientId,
      clientSecret: config.spotifyClientSecret,
    });

    // SoundCloud client
    this.scdl = scdl;

    this._loadCommands();
    this._loadEvents();
    this._refreshSpotifyToken();
  }

  _loadCommands() {
    const dir = path.join(__dirname, "../commands");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const cmd = require(path.join(dir, file));
      this.commands.set(cmd.data.name, cmd);
    }
    console.log(`[Bot] Loaded ${this.commands.size} commands`);
  }

  _loadEvents() {
    const dir = path.join(__dirname, "../events");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const event = require(path.join(dir, file));
      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args, this));
      } else {
        this.client.on(event.name, (...args) => event.execute(...args, this));
      }
    }
  }

  async _refreshSpotifyToken() {
    try {
      const data = await this.spotify.clientCredentialsGrant();
      this.spotify.setAccessToken(data.body.access_token);
      // Refresh 1 minute before expiry
      setTimeout(() => this._refreshSpotifyToken(), (data.body.expires_in - 60) * 1000);
      console.log("[Spotify] Token refreshed");
    } catch (err) {
      console.error("[Spotify] Failed to get token:", err.message);
      setTimeout(() => this._refreshSpotifyToken(), 10_000);
    }
  }

  start() {
    this.client.login(config.token);
  }
}

module.exports = Bot;
