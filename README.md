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

## Getting started with the tracker board
The omni tracker started out as a simple initiative tracker, but eventually became a massive feature that tracks nearly everything about a character. You can use the `!omni help` command in any channel to get a PM with various examples, but something as massive as the omni tracker demanded a tutorial to help players get started quickly. The following commands will add your character and set up some basic stats. Note that you could combine these into one long command; I've split them up into hopefully easier-to-digest chunks.

1. Add your PC and some basic stats with the command `!omni add player CharacterName HP:20/20`. Replace the CharacterName with your name, and the HP numbers with your character's.
1. Let's add some basic stats like Level, Wisdom Mod, and Dexterity Mod that will come in handy later. `!omni set stat CharacterName Level:1 WIS:3 DEX:2`
1. Typically GMs like having easy access to your AC. Let's prefix the name with an ! to add that as an important stat, which causes it to always be displayed next to your HP. `!omni set stat CharacterName !AC:15`.
1. Let's get fancy. Perception and Stealth are used most often for rolling initiative, and we do that all the time. Let's make that easier with the command `!omni set stat CharacterName Trained:=Level+2 Perception:={1d20}+WIS+Trained Stealth:={1d20}+DEX+Trained`. Again, replace the WIS and DEX values with ones from your sheet. This command does multiple things- sets your Wisdom and Dex modifiers, and then creates three dynamic stats which use them along with the Level stat you set earlier.
1. Let's test it out! `!roll Stealth` and see what you get!
1. When it comes time to roll for init, you can roll using stealth with `!init Stealth`. Since perception is most common, you can use the shortcut of `!init` to roll your perception.
1. When you level up, simply update your level using `!omni set stat CharacterName Level:2` and all the dynamic stats above will automatically update. Yay!

## Requirements
* Node JS 13+
* Everything in the packages.json
* If you're running this on a headless Linux server, you may need some X dependencies for the instance of Chrome used to lookup terms. Those can be found here: https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md
* In order to use the omni commands you'll need a hidden bot-data channel for the bot to save state in. This will be automated in the future hopefully.

## Design choices
I've made a couple of design choices that I hope won't bite me later. 

* I don't want a huge backend database. Everything will either be stateless, store state in the discord guild itself, or derive state from previous messages. This may make bot interactions a tad slower (although hopefully not noticable), but will hopefully dramatically ease my job if I have to scale this later.
* Bot commands should be human readable. Saving keystrokes in bot commands is only nice if your players can remember the archaic syntax. This also helps mobile Discord players, as mobile keyboards assume you're trying to type English. Shortcuts will be made available for commands that are used repeatedly.
