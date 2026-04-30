const {
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");
const config = require("../config");

class MusicQueue {
  /**
   * @param {object} opts
   * @param {import("discord.js").TextChannel} opts.textChannel
   * @param {import("@discordjs/voice").VoiceConnection} opts.connection
   * @param {import("soundcloud-downloader").default} opts.scdl
   */
  constructor({ textChannel, connection, scdl }) {
    this.textChannel = textChannel;
    this.connection = connection;
    this.scdl = scdl;

    this.songs = [];
    this.volume = config.defaultVolume / 100;
    this.loop = "none"; // "none" | "track" | "queue"
    this.playing = false;
    this.paused = false;

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this._disconnectTimer = null;

    // Handle player state changes
    this.player.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.player.on("error", (err) => {
      console.error(`[Player Error] ${err.message}`);
      this._advance();
    });

    // Handle voice connection drops
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  get currentSong() {
    return this.songs[0] || null;
  }

  get size() {
    return this.songs.length;
  }

  enqueue(song) {
    this.songs.push(song);
  }

  enqueueMany(songs) {
    this.songs.push(...songs);
  }

  async play() {
    if (!this.currentSong) return;
    this.playing = true;
    this.paused = false;

    try {
      const resource = await this.currentSong.makeResource(this.scdl);
      if (resource.volume) resource.volume.setVolume(this.volume);
      this.player.play(resource);
      this._currentResource = resource;

      // Add to recent cache (max 10)
      if (this.onSongPlay) this.onSongPlay(this.currentSong);
    } catch (err) {
      console.error(`[MusicQueue] Failed to play: ${err.message}`);
      this.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription(`❌ Failed to play **${this.currentSong.title}** — skipping.`),
        ],
      });
      this._advance();
    }
  }

  skip() {
    this.player.stop(true);
  }

  pause() {
    if (this.player.pause()) {
      this.paused = true;
      return true;
    }
    return false;
  }

  resume() {
    if (this.player.unpause()) {
      this.paused = false;
      return true;
    }
    return false;
  }

  setVolume(vol) {
    this.volume = vol / 100;
    if (this._currentResource?.volume) {
      this._currentResource.volume.setVolume(this.volume);
    }
  }

  shuffle() {
    if (this.songs.length <= 1) return;
    const current = this.songs.shift();
    for (let i = this.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
    }
    this.songs.unshift(current);
  }

  destroy() {
    this.songs = [];
    this.playing = false;
    clearTimeout(this._disconnectTimer);
    try {
      this.player.stop(true);
      this.connection.destroy();
    } catch {}
  }

  _onIdle() {
    if (this.loop === "track") {
      return this.play();
    }

    if (this.loop === "queue") {
      const finished = this.songs.shift();
      this.songs.push(finished);
      return this.play();
    }

    this._advance();
  }

  _advance() {
    this.songs.shift();

    if (this.songs.length === 0) {
      this.playing = false;
      this.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription("✅ Queue finished. Leaving in 30 seconds if nothing is added."),
        ],
      });

      this._disconnectTimer = setTimeout(() => {
        if (!this.playing) this.destroy();
      }, config.disconnectTimeout);
      return;
    }

    this.play();
  }
}

module.exports = MusicQueue;
