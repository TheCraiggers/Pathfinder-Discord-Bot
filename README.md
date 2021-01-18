# Pathfinder Discord Bot
*A bot to help Pathfinder 2e players using Discord.*

## Features
* Pathfinder 2e spell/feat/class/etc lookup using the awesome [Pathfinder 2 Easy Library](http://pf2.easytool.es/)
* Initiative tracker with details hidden for players
* Tracking HP, AC, and any other stat or property you can think of (supporting numerical and textual values)
* Dice roller
* A robust spreadsheet-like reference system allowing for things like Perception={1d20+[Expert]+2}
* Time of day and date tracker
* Condition tracker that automatically updates durations based on elapsed time

## Why?
There are plenty of dice bots out there, but I wanted something to help track game state. And while there are some full-featured bots like Avrae, there are always quirks when using them for Pathfinder 2e, such as when players and monsters tie for initiative.

Also, I wanted to create something to help my GM and fellow players.

## Looking up Pathfinder terms
Once the bot is in your channel, you can use the following to lookup a term and have it delivered directly to your channel:
* `!lookup <Pathfinder term>`

## Heroku Deployment
It is possible to deploy the bot on Heroku.
- Under Deploy, select your preferred deployment method
- Under Resources, ensure that the **worker** Dyno is enabled
- Under Settings, add a buildpack of `https://github.com/jontewks/puppeteer-heroku-buildpack.git`
- Under Settings > Config Vars, add DISCORD_TOKEN, <YOUR_DISCORD_TOKEN>

## Getting started with the tracker board for Players
The omni tracker started out as a simple initiative tracker, but eventually became a massive feature that tracks nearly everything about a character. You can use the `!omni help` command in any channel to get a PM with various examples, but something as massive as the omni tracker demanded a tutorial to help players get started quickly. The following commands will add your character and set up some basic stats. Note that you could combine these into one long command; I've split them up into hopefully easier-to-digest chunks.

1. Add your PC and some basic stats with the command `!omni add player CharacterName HP:20/20`. Replace the CharacterName with your name, and the HP numbers with your character's.
1. Let's add some basic stats like Level, Wisdom Mod, and Dexterity Mod that will come in handy later. `!omni set stat CharacterName Level:1 WIS:3 DEX:2`
1. Typically GMs like having easy access to your AC. Let's prefix the name with an ! to add that as an important stat, which causes it to always be displayed next to your HP. `!omni set stat CharacterName !AC:15`.
1. Let's get fancy. Perception and Stealth are used most often for rolling initiative, and we do that all the time. Let's make that easier with the command `!omni set stat CharacterName Trained:=1d20+Level+2 Perception:=WIS+Trained Stealth:=+DEX+Trained`. Again, replace the WIS and DEX values with ones from your sheet. This command does multiple things- sets your Wisdom and Dex modifiers, and then creates three dynamic stats which use them along with the Level stat you set earlier.
1. Let's test it out! `!roll Stealth` and see what you get!
1. When it comes time to roll for init, you can roll using stealth with `!init Stealth`. Since perception is most common, you can use the shortcut of `!init` to roll your perception.
1. When you level up, simply update your level using `!omni set stat CharacterName Level:2` and all the dynamic stats above will automatically update. Yay!
1. Adding other skills, ability scores, and other stuff is left for an excercise to the reader.

## Getting started as a GM
So your players have aded their characters and they have exchanged gotten past the typical character introductions. It's time to fight! Let's go through the usual commands you'll need during an encounter.

1. Instruct your players to roll for initiative using some variation of the `!init` command.
1. Next, switch to your private GM channel the bot created for you after setup. If you do not see one, you may have to be granted the GM role, ask the server owner to grant it to you.
1. While your playerse are rolling, we'll add some enemies. This example uses wolves, change the stats as needed. `!omni add enemy Wolf1 HP:24 init:{1d20+6}
1. Add as many wolves and other critters as you need.
1. Once everyone has rolled for initiative (You'll know as all players will have their init numebrs to the left of their names on the Omni Tracker) you can use `!next` to start combat.
1. The big bad wolf attacks a player and hits. Use `!damage CharacterName 5` to deal 5 points to CharacterName.
1. Maybe the wolf's teeth cause some bleeding- use `!omni add effect CharacterName Bleeding1` to give them the bleed effect.
1. Every each turn is complete, use `!next` to advance to the next character.
1. A PC attacks a wolf and gets a crit, dealing 30 points of damage and killing it in one blow. `!damage Wolf1 30` will deal 30 points to it. The bot automatically removes it from combat as that's more than its max health.
1. Eventually, the last wolf goes down. The bot ends the combat automatically and clears the initiative numbers.
1. A player wants to use TreatWounds, which has a cooldown of 1 hour. Use `!omni add effect WoundsTreated 1 hour` to add a note to their character. 
1. They then walk for a few hours. Use `!time 3 hours` to move time ahead 3 hours. The WoundsTreated note automatically is removed.

## Requirements
* Node JS 13+
* Everything in the packages.json
* If you're running this on a headless Linux server, you may need some X dependencies for the instance of Chrome used to lookup terms. Those can be found here: https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md
* In order to use the omni commands you'll need a hidden bot-data channel for the bot to save state in. This will be automated in the future hopefully.

## Design choices
I've made a couple of design choices that I hope won't bite me later. 

* I don't want a huge backend database. Everything will either be stateless, store state in the discord guild itself, or derive state from previous messages. This may make bot interactions a tad slower (although hopefully not noticable), but will hopefully dramatically ease my job if I have to scale this later.
* Bot commands should be human readable. Saving keystrokes in bot commands is only nice if your players can remember the archaic syntax. This also helps mobile Discord players, as mobile keyboards assume you're trying to type English. Shortcuts will be made available for commands that are used repeatedly.
