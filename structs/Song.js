const youtube = require("youtube-sr").default;
const { createAudioResource, StreamType } = require("@discordjs/voice");
const { spawn } = require("child_process");
const path = require("path");

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
const SPOTIFY_REGEX = /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
const SOUNDCLOUD_REGEX = /^https?:\/\/(soundcloud\.com|snd\.sc)\/.+/;

const ffmpegPath = require("ffmpeg-static");
const ytdlpPath = path.join(
  path.dirname(require.resolve("yt-dlp-exec")),
  "..",
  "bin",
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);

class Song {
  constructor({ title, url, duration, thumbnail, requestedBy, _isSoundCloud }) {
    this.title = title;
    this.url = url;
    this.duration = duration; // seconds
    this.thumbnail = thumbnail;
    this.requestedBy = requestedBy;
    this._isSoundCloud = _isSoundCloud || false;
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

  static async from(query, requestedBy, scdl) {
    if (SPOTIFY_REGEX.test(query)) return Song._fromSpotify(query, requestedBy);
    if (SOUNDCLOUD_REGEX.test(query)) return Song._fromSoundCloud(query, requestedBy, scdl);
    if (YOUTUBE_REGEX.test(query)) return Song._fromYouTubeUrl(query, requestedBy);
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
    const result = await youtube.searchOne(query).catch(() => null);
    if (!result) throw new Error(`No results found for **${query}**`);
    return new Song({
      title: result.title,
      url: `https://www.youtube.com/watch?v=${result.id}`,
      duration: result.duration / 1000,
      thumbnail: result.thumbnail?.url,
      requestedBy,
    });
  }

  static async _fromSpotify(url, requestedBy) {
    const { getData, getPreview } = require("spotify-url-info")(require("node-fetch"));
    const [, type] = url.match(SPOTIFY_REGEX);

    if (type === "track") {
      const data = await getPreview(url);
      const query = `${data.title} ${data.artist}`;
      const song = await Song._fromSearch(query, requestedBy);
      song.title = `${data.title} — ${data.artist}`;
      song.thumbnail = data.image || song.thumbnail;
      return song;
    }

    if (type === "playlist" || type === "album") {
      const data = await getData(url);
      const tracks = type === "playlist"
        ? data.tracks.items.map((i) => i.track).filter(Boolean)
        : data.tracks.items;

      const songs = await Promise.all(
        tracks.map(async (track) => {
          const artist = track.artists?.[0]?.name || "";
          const query = `${track.name} ${artist}`;
          const song = await Song._fromSearch(query, requestedBy).catch(() => null);
          if (song) {
            song.title = artist ? `${track.name} — ${artist}` : track.name;
            song.thumbnail = data.images?.[0]?.url || song.thumbnail;
          }
          return song;
        })
      );
      return songs.filter(Boolean);
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

  async makeResource(scdl) {
    if (this._isSoundCloud) {
      const stream = await scdl.download(this.url);
      return createAudioResource(stream, { metadata: this, inlineVolume: true });
    }

    const { spawn, execFile } = require("child_process");
    const path = require("path");
    const http = require("http");
    const https = require("https");

    // Step 1: get the direct stream URL quickly (no download)
    const streamUrl = await new Promise((resolve, reject) => {
      const proc = spawn(
        ytdlpPath,
        [
          this.url,
          "-f", "bestaudio/best",
          "--no-playlist",
          "--extractor-args", "youtube:player_client=android_vr",
          "-g", // just print the URL, don't download
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      let out = "";
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", () => {}); // suppress
      proc.on("close", (code) => {
        const url = out.trim().split("\n")[0];
        if (url) resolve(url);
        else reject(new Error("yt-dlp could not get stream URL"));
      });
      proc.on("error", reject);
    });

    // Step 2: pipe the direct URL through ffmpeg (starts immediately)
    const ffmpeg = spawn(
      ffmpegPath,
      [
        "-fflags", "nobuffer",
        "-flags", "low_delay",
        "-i", streamUrl,
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "2",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    ffmpeg.stderr.on("data", (d) => {
      const msg = d.toString();
      if (!msg.includes("size=") && !msg.includes("time=")) console.error("[ffmpeg]", msg.trim());
    });
    ffmpeg.on("error", (e) => console.error("[ffmpeg error]", e.message));

    return createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      metadata: this,
      inlineVolume: true,
    });
  }
}

module.exports = Song;
