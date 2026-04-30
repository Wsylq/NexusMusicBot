const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");
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

    /** @type {Array<{title: string, url: string, thumbnail: string, playCount: number}>} */
    this.recentSongs = []; // last 10 played, most recent first

    // SoundCloud client
    this.scdl = scdl;

    this._loadCommands();
    this._loadEvents();
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

  start() {
    this.client.login(config.token);
  }

  addToRecentSongs(song) {
    // Remove duplicate if already in list
    this.recentSongs = this.recentSongs.filter((s) => s.url !== song.url);
    // Add to front
    this.recentSongs.unshift({ title: song.title, url: song.url, thumbnail: song.thumbnail });
    // Keep max 10
    if (this.recentSongs.length > 10) this.recentSongs.pop();
  }
}

module.exports = Bot;
