const ytdl = require("yt-dlp-exec");
const youtube = require("youtube-sr").default;
const { createAudioResource, StreamType } = require("@discordjs/voice");
const { Readable } = require("stream");

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
const SPOTIFY_REGEX = /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
const SOUNDCLOUD_REGEX = /^https?:\/\/(soundcloud\.com|snd\.sc)\/.+/;

class Song {
  constructor({ title, url, duration, thumbnail, requestedBy }) {
    this.title = title;
    this.url = url;
    this.duration = duration;       // seconds
    this.thumbnail = thumbnail;
    this.requestedBy = requestedBy;
  }

  get durationFormatted() {
    if (!this.duration) return "LIVE";
    const h = Math.floor(this.duration / 3600);
    const m = Math.floor((this.duration % 3600) / 60);
    const s = this.duration % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  }

  /**
   * Resolve a query/url into a Song (or array of Songs for playlists)
   * @param {string} query
   * @param {import("discord.js").User} requestedBy
   * @param {import("spotify-web-api-node")} spotifyApi
   * @param {import("soundcloud-downloader").default} scdl
   * @returns {Promise<Song | Song[]>}
   */
  static async from(query, requestedBy, spotifyApi, scdl) {
    // --- Spotify ---
    if (SPOTIFY_REGEX.test(query)) {
      const [, type, id] = query.match(SPOTIFY_REGEX);
      return Song._fromSpotify(type, id, requestedBy, spotifyApi);
    }

    // --- SoundCloud ---
    if (SOUNDCLOUD_REGEX.test(query)) {
      return Song._fromSoundCloud(query, requestedBy, scdl);
    }

    // --- YouTube URL ---
    if (YOUTUBE_REGEX.test(query)) {
      return Song._fromYouTubeUrl(query, requestedBy);
    }

    // --- Text search → YouTube ---
    return Song._fromSearch(query, requestedBy);
  }

  static async _fromYouTubeUrl(url, requestedBy) {
    const info = await youtube.getVideo(url).catch(() => null);
    if (!info) throw new Error("Could not fetch YouTube video info.");
    return new Song({
      title: info.title,
      url: `https://www.youtube.com/watch?v=${info.id}`,
      duration: info.duration / 1000,
      thumbnail: info.thumbnail?.url,
      requestedBy,
    });
  }

  static async _fromSearch(query, requestedBy) {
    const result = await youtube.searchOne(query);
    if (!result) throw new Error(`No results found for: ${query}`);
    return new Song({
      title: result.title,
      url: `https://www.youtube.com/watch?v=${result.id}`,
      duration: result.duration / 1000,
      thumbnail: result.thumbnail?.url,
      requestedBy,
    });
  }

  static async _fromSpotify(type, id, requestedBy, spotifyApi) {
    if (type === "track") {
      const data = await spotifyApi.getTrack(id);
      const track = data.body;
      const query = `${track.name} ${track.artists.map((a) => a.name).join(" ")}`;
      const song = await Song._fromSearch(query, requestedBy);
      song.title = `${track.name} — ${track.artists[0].name}`;
      song.thumbnail = track.album.images[0]?.url || song.thumbnail;
      return song;
    }

    if (type === "playlist") {
      const data = await spotifyApi.getPlaylist(id);
      const items = data.body.tracks.items.filter((i) => i.track);
      return Promise.all(
        items.map(async ({ track }) => {
          const query = `${track.name} ${track.artists.map((a) => a.name).join(" ")}`;
          const song = await Song._fromSearch(query, requestedBy).catch(() => null);
          if (song) {
            song.title = `${track.name} — ${track.artists[0].name}`;
            song.thumbnail = track.album.images[0]?.url || song.thumbnail;
          }
          return song;
        })
      ).then((songs) => songs.filter(Boolean));
    }

    if (type === "album") {
      const data = await spotifyApi.getAlbum(id);
      const tracks = data.body.tracks.items;
      const albumArt = data.body.images[0]?.url;
      return Promise.all(
        tracks.map(async (track) => {
          const query = `${track.name} ${track.artists.map((a) => a.name).join(" ")}`;
          const song = await Song._fromSearch(query, requestedBy).catch(() => null);
          if (song) {
            song.title = `${track.name} — ${track.artists[0].name}`;
            song.thumbnail = albumArt || song.thumbnail;
          }
          return song;
        })
      ).then((songs) => songs.filter(Boolean));
    }

    throw new Error(`Unsupported Spotify type: ${type}`);
  }

  static async _fromSoundCloud(url, requestedBy, scdl) {
    const info = await scdl.getInfo(url);
    return new Song({
      title: info.title,
      url,
      duration: Math.floor(info.duration / 1000),
      thumbnail: info.artwork_url,
      requestedBy,
      _isSoundCloud: true,
    });
  }

  /**
   * Create a playable AudioResource from this song
   * @param {import("soundcloud-downloader").default} scdl
   */
  async makeResource(scdl) {
    if (this._isSoundCloud) {
      const stream = await scdl.download(this.url);
      return createAudioResource(stream, {
        metadata: this,
        inlineVolume: true,
      });
    }

    // YouTube via yt-dlp piped to ffmpeg
    const ffmpegPath = require("ffmpeg-static");
    const { spawn } = require("child_process");

    const ytdlpProcess = spawn(
      require("yt-dlp-exec").raw,
      [
        this.url,
        "-f", "bestaudio[ext=webm]/bestaudio/best",
        "--no-playlist",
        "-o", "-",
        "--quiet",
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );

    const ffmpegProcess = spawn(
      ffmpegPath,
      [
        "-i", "pipe:0",
        "-f", "opus",
        "-ar", "48000",
        "-ac", "2",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "ignore"] }
    );

    ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);

    return createAudioResource(ffmpegProcess.stdout, {
      inputType: StreamType.OggOpus,
      metadata: this,
      inlineVolume: true,
    });
  }
}

module.exports = Song;
