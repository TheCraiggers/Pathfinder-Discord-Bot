import { Client } from "discord.js";
import * as config from "./config.json";
import OmniPlugin from "./modules/omni-tracker";
import lookup from "./modules/lookup";

const client: Client = new Client();

const discordToken: string = config.token;
if (discordToken === "insertDiscordTokenHere")
  throw "No discord token found! Create config.json and add your Discord Bot Token";

client.on("ready", () => {
  if (client.user != null) {
    console.log(`Logged in as ${client.user.tag}!`);
  } else {
    throw "Could not log in! Check your settings.";
  }
});

client.login(discordToken).catch(console.error);
/*-------------------------------------------------------------------------------
Above is the important discord connection and event handler stuff. 
Below is also important, but it's the custom bot commands!
--------------------------------------------------------------------------------*/

new lookup(client);
new OmniPlugin(client);
