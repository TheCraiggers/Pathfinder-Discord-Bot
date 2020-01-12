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

## Getting started
Once the bot is in your channel, you can use the following commands to interact with it:
* !lookup <Pathfinder term>
* !omni help

## Requirements
* Node JS 13+
* Everything in the packages.json
* If you're running this on a headless Linux server, you may need some X dependencies for the instance of Chrome used to lookup terms. Those can be found here: https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md
* In order to use the omni commands you'll need a hidden bot-data channel for the bot to save state in. This will be automated in the future hopefully.

## Design choices
I've made a couple of design choices that I hope won't bite me later. 

* I don't want a huge backend database. Everything will either be stateless, store state in the discord guild itself, or derive state from previous messages. This may make bot interactions a tad slower (although hopefully not noticable), but will hopefully dramatically ease my job if I have to scale this later.
* Bot commands should be human readable. Saving keystrokes in bot commands is only nice if your players can remember the archaic syntax. This also helps mobile Discord players, as mobile keyboards assume you're trying to type English. Shortcuts will be made available for commands that are used repeatedly.
