require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");

const commands = readdirSync(path.join(__dirname, "commands"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => require(path.join(__dirname, "commands", f)).data.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.token);

(async () => {
  try {
    // First clear ALL existing commands globally
    console.log("Clearing old slash commands...");
    await rest.put(Routes.applicationCommands(process.env.clientId), { body: [] });
    console.log("✅ Cleared old commands.");

    // Now deploy the new ones
    console.log(`Deploying ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(process.env.clientId), { body: commands });
    console.log("✅ Done!");
  } catch (err) {
    console.error(err);
  }
})();
