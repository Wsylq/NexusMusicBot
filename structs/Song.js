// Song.js — resolves Spotify/SoundCloud URLs to search queries for Lavalink
const youtube = require("youtube-sr").default;

const SPOTIFY_REGEX = /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
const SOUNDCLOUD_REGEX = /^https?:\/\/(soundcloud\.com|snd\.sc)\/.+/;
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;

class Song {
  /**
   * Resolve a query into { searchQuery, title, thumbnail } or array of those for playlists
   * Lavalink handles the actual audio — we just need the right search string
   */
  static async resolve(query, requestedBy, scdl) {
    // YouTube — pass directly to Lavalink
    if (YOUTUBE_REGEX.test(query)) {
      return { searchQuery: query, title: null, thumbnail: null };
    }

    // Spotify
    if (SPOTIFY_REGEX.test(query)) {
      return Song._resolveSpotify(query);
    }

    // SoundCloud
    if (SOUNDCLOUD_REGEX.test(query)) {
      return { searchQuery: query, title: null, thumbnail: null };
    }

    // Plain text search
    return { searchQuery: query, title: null, thumbnail: null };
  }

  static async _resolveSpotify(url) {
    const fetch = require("node-fetch");
    const { getData, getPreview } = require("spotify-url-info")(fetch);
    const [, type] = url.match(SPOTIFY_REGEX);

    if (type === "track") {
      const data = await getPreview(url);
      return {
        searchQuery: `${data.title} ${data.artist}`,
        title: `${data.title} — ${data.artist}`,
        thumbnail: data.image,
      };
    }

    if (type === "playlist" || type === "album") {
      const data = await getData(url);
      const tracks = type === "playlist"
        ? data.tracks.items.map((i) => i.track).filter(Boolean)
        : data.tracks.items;

      return tracks.map((track) => {
        const artist = track.artists?.[0]?.name || "";
        return {
          searchQuery: `${track.name} ${artist}`.trim(),
          title: artist ? `${track.name} — ${artist}` : track.name,
          thumbnail: data.images?.[0]?.url || null,
        };
      });
    }

    throw new Error(`Unsupported Spotify type: ${type}`);
  }
}

module.exports = Song;
