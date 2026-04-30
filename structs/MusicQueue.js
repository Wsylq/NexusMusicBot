const {
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const { EmbedBuilder } = require("discord.js");
const config = require("../config");

class MusicQueue {
  constructor({ textChannel, connection, scdl }) {
    this.textChannel = textChannel;
    this.connection = connection;
    this.scdl = scdl;

    this.songs = [];
    this.volume = config.defaultVolume / 100;
    this.loop = "none"; // "none" | "track" | "queue"
    this.playing = false;
    this.paused = false;

    this._prefetchedResource = null; // pre-fetched resource for next song
    this._prefetchingSong = null;    // which song is being prefetched
    this._disconnectTimer = null;

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.player.on("error", (err) => {
      console.error(`[Player Error] ${err.message}`);
      this._advance();
    });

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
    // If nothing is playing, prefetch this song immediately
    if (!this.playing) this._prefetch(song);
  }

  enqueueMany(songs) {
    this.songs.push(...songs);
    if (!this.playing && songs.length > 0) this._prefetch(songs[0]);
  }

  // Start building the audio resource in the background
  _prefetch(song) {
    if (!song || this._prefetchingSong?.url === song.url) return;
    this._prefetchingSong = song;
    this._prefetchedResource = null;

    song.makeResource(this.scdl)
      .then((resource) => {
        // Only keep it if it's still the right song
        if (this._prefetchingSong?.url === song.url) {
          this._prefetchedResource = resource;
          console.log(`[Prefetch] Ready: ${song.title}`);
        }
      })
      .catch((err) => {
        console.error(`[Prefetch] Failed for ${song.title}:`, err.message);
        this._prefetchedResource = null;
        this._prefetchingSong = null;
      });
  }

  async play() {
    if (!this.currentSong) return;
    this.playing = true;
    this.paused = false;
    clearTimeout(this._disconnectTimer);

    try {
      let resource;

      // Use prefetched resource if it's for the current song
      if (this._prefetchedResource && this._prefetchingSong?.url === this.currentSong.url) {
        resource = this._prefetchedResource;
        this._prefetchedResource = null;
        this._prefetchingSong = null;
        console.log(`[Queue] Using prefetched resource for: ${this.currentSong.title}`);
      } else {
        resource = await this.currentSong.makeResource(this.scdl);
      }

      if (resource.volume) resource.volume.setVolume(this.volume);
      this.player.play(resource);
      this._currentResource = resource;

      if (this.onSongPlay) this.onSongPlay(this.currentSong);

      // Prefetch the next song while this one plays
      if (this.songs[1]) this._prefetch(this.songs[1]);

    } catch (err) {
      console.error(`[MusicQueue] Failed to play: ${err.message}`);
      this.textChannel.send({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Failed to play **${this.currentSong.title}** — skipping.`)],
      });
      this._advance();
    }
  }

  skip() {
    this.player.stop(true);
  }

  pause() {
    if (this.player.pause()) { this.paused = true; return true; }
    return false;
  }

  resume() {
    if (this.player.unpause()) { this.paused = false; return true; }
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
    // Prefetch new next song after shuffle
    if (this.songs[1]) this._prefetch(this.songs[1]);
  }

  destroy() {
    this.songs = [];
    this.playing = false;
    this._prefetchedResource = null;
    this._prefetchingSong = null;
    clearTimeout(this._disconnectTimer);
    try { this.player.stop(true); this.connection.destroy(); } catch {}
  }

  _onIdle() {
    if (this.loop === "track") return this.play();
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
        embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("✅ Queue finished. Leaving in 30 seconds if nothing is added.")],
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
