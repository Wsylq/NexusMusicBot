module.exports = {
  name: "clientReady",
  once: true,
  execute(client) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    client.user.setActivity("music 🎵", { type: 2 }); // LISTENING
  },
};
