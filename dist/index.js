"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config = require("./config.json");
const omni_tracker_1 = require("./modules/omni-tracker");
const lookup_1 = require("./modules/lookup");
const client = new discord_js_1.Client();
const discordToken = config.token;
if (discordToken === "insertDiscordTokenHere")
    throw "No discord token found! Create config.json and add your Discord Bot Token";
client.on("ready", () => {
    if (client.user != null) {
        console.log(`Logged in as ${client.user.tag}!`);
    }
    else {
        throw "Could not log in! Check your settings.";
    }
});
client.login(discordToken).catch(console.error);
/*-------------------------------------------------------------------------------
Above is the important discord connection and event handler stuff.
Below is also important, but it's the custom bot commands!
--------------------------------------------------------------------------------*/
new lookup_1.default(client);
new omni_tracker_1.default(client);
