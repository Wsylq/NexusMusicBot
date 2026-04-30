const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { Manager } = require("moonlink.js");
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
      ws: { buildIdentifyPayload: undefined },
    });

    // Forward raw voice packets to moonlink manually
    this.client.on("raw", (packet) => {
      if (!this.manager?.initialized) return;
      if (!["VOICE_SERVER_UPDATE", "VOICE_STATE_UPDATE"].includes(packet.t)) return;
      const d = packet.d;
      this.manager.packetUpdate({
        t: packet.t,
        d: {
          ...d,
          guild_id: d.guild_id ?? d.guildId,
          user_id: d.user_id ?? d.userId,
          session_id: d.session_id ?? d.sessionId,
          channel_id: d.channel_id ?? d.channelId,
        },
      });
    });

    /** @type {Collection<string, object>} */
    this.commands = new Collection();

    /** @type {Array<{title: string, url: string, thumbnail: string}>} */
    this.recentSongs = [];

    /** @type {Map<string, number>} guild volume persistence */
    this.guildVolumes = new Map();

    this.scdl = scdl;

    // Moonlink (Lavalink v4 client)
    this.manager = new Manager({
      nodes: [
        {
          host: config.lavalink.host,
          port: config.lavalink.port,
          password: config.lavalink.password,
          secure: config.lavalink.secure,
        },
      ],
      options: {
        clientName: "NexusMusic",
      },
      send: (guildId, payload) => {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
    });

    this._setupManagerEvents();
    this._loadCommands();
    this._loadEvents();
  }

  _setupManagerEvents() {
    this.manager.on("nodeCreate", (node) =>
      console.log(`[Lavalink] Node connected: ${node.host}`)
    );

    this.manager.on("nodeError", (node, err) =>
      console.error(`[Lavalink] Node error on ${node.host}:`, err?.message || err)
    );

    this.manager.on("nodeDestroy", (node) =>
      console.error(`[Lavalink] Node destroyed: ${node.host}`)
    );

    this.manager.on("nodeReconnect", (node) =>
      console.warn(`[Lavalink] Node reconnecting: ${node.host}`)
    );

    this.manager.on("debug", (msg) => {
      if (msg.includes("error") || msg.includes("Error") || msg.includes("fail") || msg.includes("close") || msg.includes("Close")) {
        console.error("[Lavalink Debug]", msg);
      }
    });

    this.manager.on("trackStart", (player, track) => {
      const channelId = player.textChannelId || player.textChannel;
      const channel = this.client.channels.cache.get(channelId);

      // Add to recent cache
      this.addToRecentSongs({
        title: track.title,
        url: track.uri,
        thumbnail: track.artworkUrl || track.thumbnail,
      });
      console.log(`[Recent] Added: ${track.title} | Total: ${this.recentSongs.length}`);

      if (!channel) return;

      const { EmbedBuilder } = require("discord.js");
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: "▶️ Now Playing" })
        .setTitle(track.title)
        .setURL(track.uri)
        .addFields(
          { name: "Duration", value: track.isStream ? "LIVE" : _formatDuration(track.duration), inline: true },
          { name: "Requested by", value: track.requester ? `<@${track.requester}>` : "Unknown", inline: true }
        );

      if (track.artworkUrl) embed.setThumbnail(track.artworkUrl);
      channel.send({ embeds: [embed] }).catch(() => {});
    });

    this.manager.on("trackException", (player, track, exception) => {
      const channelId = player.textChannelId || player.textChannel;
      const channel = this.client.channels.cache.get(channelId);
      console.error(`[Track Error] ${track?.title}: ${exception?.message?.split("\n")[0]}`);
      if (channel) {
        const { EmbedBuilder } = require("discord.js");
        channel.send({
          embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Failed to play **${track?.title}** — skipping.`)],
        }).catch(() => {});
      }
      // Skip to next track instead of destroying
      try { player.skip(); } catch {}
    });

    this.manager.on("queueEnd", (player) => {
      const channelId = player.textChannelId || player.textChannel;
      const channel = this.client.channels.cache.get(channelId);
      if (channel) {
        const { EmbedBuilder } = require("discord.js");
        channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(config.embedColor)
              .setDescription("✅ Queue finished."),
          ],
        }).catch(() => {});
      }
      setTimeout(() => {
        if (!player.playing) player.destroy();
      }, config.disconnectTimeout);
    });
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

  addToRecentSongs(song) {
    this.recentSongs = this.recentSongs.filter((s) => s.url !== song.url);
    this.recentSongs.unshift(song);
    if (this.recentSongs.length > 10) this.recentSongs.pop();
  }

  start() {
    this.client.login(config.token);
  }
}

function _formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

module.exports = Bot;
