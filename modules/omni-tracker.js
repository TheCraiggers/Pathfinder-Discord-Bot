var helpMessage = `
\`\`\`
Most commands follow the '!omni <verb> <noun> <target> <properties>' pattern
Verbs: add, set, remove, show, roll
Nouns: tracker, player, effect, enemy, time, shield, property, shield, pet, familiar, group
Targets: names of players or enemies (quotes required if there are spaces), !players, !enemies, !everybody, !everyone
Properties: used for setting durations, hit points, etc. AC, HP, etc.

Some commands are typed often so shorter aliases are provided for them. This doesn't mean the longer version doesn't work though!

# Aliases
!roll <stat>            (Roll the player's given stat that typed this and display it)
!roll <stat1>:<stat2>   (Roll the player's stat2 and put the results in stat1)
!init                   (Roll Perception stat and save it as your Initiative)
!init Stealth           (Roll the Stealth stat and save it as your Initiave)
!heal Bob 5
!damage Bob 5
!time 1 min             (Alias for !omni add time tracker 1 min)

# Stats:
Characters can have various stats, whatever you want to track. HP and AC are common, but other things can be tracked as well.

Also, stats can use {dice notation} and [references] to other stats. Just like in spreadsheets, prefixing with an equals sign
denotes a formula. For example, adding a dynamic stat called Perception could be written like:
!omni set stat Bob Perception:={1d20+[Expert]+[WIS]}

After, you can do things like '!roll init:[Perception]' to roll your perception and set your initiative to the result. Fancy!
If you don't like being fancy, '!roll init:{1d20+7}' still works.

# Special / Reserved stats:
HP: Character health
Initiative: The chracter's rolled initiative for combat, used in tracker order
\`\`\`
`;
exampleHelpMessage = `
\`\`\`
Examples:

!omni help                                      (Displays this.)
!omni add tracker here players                  (Create an omni tracker for players in this channel.)
!omni add player Bob AC:10 HP:18/20             (Add a new player Bob controlled by the person who typed the command.)
!omni remove player Bob                         (Add a new player Bob controlled by the person who typed the command.)
!omni set player Bob AC:20 HP:15/30             (Set Bob's AC to 20 and current HP to 15 of 30.)
!omni add effect Bob dizzy 5 rounds             (Make Bob dizzy for 5 rounds.)
!omni add effect Bob sick 2 days                (Makes Bob sick for 2 days.)
!omni remove effect Bob Dizzy                   (Remove Dizzy from Bob prematurely)
!omni add effect %players Inspired 1 round      (Gives all PCs the Inspired effect)
!omni add effect %all 'On Fire' 1 round         (Makes enemies and players on fire)
!omni add effect %enemies Dumb 1 round          (Gives all enemies the dumb effect)
!omni set stat Bob init:7                       (Sets Bob's initiatve to 7)
!omni set stat Bob init:[Perception]            (Computes bob's perception and sets his init to that value)
\`\`\`
`
var gmHelpMessage = `
\`\`\`
GM Commands:

!omni add tracker here GM                   (Create a GM omni tracker in this channel. GM Trackers show more info than normal trackers, like enemy health.)
!omni add enemy 'War Boss' AC:40 HP:300/300 Init:{1d20+10}
!omni add time tracker 10min                (Moves time forward by 10 minutes)
!omni add time tracker 5 hours
!omni set time tracker tomorrow             (Moves time forward until it's tomorrow morning)
!omni set time tracker 13:00                (Moves time forward until it's 1pm)
!omni set init Bob 15                       (Change Bob's initiative to 15)
!omni set init Bob 15.1                     (Change Bob's initiative to 15.1, useful when players tie for initiative.)
!omni next                                  (When in combat, move to next character's turn)
!omni add group 'Team Bravo'
!omni add Bob 'Team Bravo'
\`\`\`
`;

var Moment = require('moment');
const { DiceRoller } = require('rpg-dice-roller/lib/umd/bundle.js');
const botCommandRegex = /^! ?(?<keyword>(omni help|omni setup|omni|roll|r|next|heal|damage|init|time))($| )/;

class OmniPlugin {
    constructor (client) {
        client.on('message', message => {
            if (botCommandRegex.test(message.content)) {
                handleCommand(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (botCommandRegex.test(newMessage.content)) {
                handleCommand(newMessage);
            }   
        });
        console.log('Successfully loaded Omni Tracker plugin.');
    }
}
module.exports = (client) => { return new OmniPlugin(client) }

class Property {
    constructor(name, currentValue, isAboveFold) {
        this.name = name;
        this.currentValue = currentValue;
        this.isAboveFold = isAboveFold;     //If it's always displayed along with your HP on the omni tracker. Otherwise, need to use show player
    }
    
    toString = function() {
        return `${this.name}:${this.currentValue}`;
    }

    static translateAliasedPropertyNames(propertyName) {
        //Given an aliased property name, will return the name it should point to. Or the same string, if it's not an alias.
        switch (propertyName.toUpperCase()) {
            case 'INIT':
                return 'initiative';
            default:
                return propertyName;
        }
    }
}
Property.propertyReferencesRegex = /\[(?<lookupReference>\w+)\]/g;

class PropertyRange extends Property {
    //Property ranges only make sense with numbers, so use *1 to force to a number of some sort;
    constructor(name, currentValue, maxValue, isAboveFold) {
        super(name, currentValue * 1, isAboveFold);
        this.maxValue = maxValue * 1;
    }
    
    toString = function() {
        return `${this.name}:${this.currentValue}/${this.maxValue}`;
    }
}

class Character {
    static importJSON(character) {
        if (character.enemy) {
            var newCharacter = new Enemy(character.name, character.owner, character.HP.currentValue, character.HP.maxValue, character.message);
        } else {
            var newCharacter = new Player(character.name, character.owner, character.HP.currentValue, character.HP.maxValue, character.message);
        }

        //Properties
        var keys = Object.keys(character.properties);
        for (let i = 0; i < keys.length; i++) {
            const property = character.properties[keys[i]];
            if (property.maxValue)
                newCharacter.properties.set(property.name, new PropertyRange(property.name, property.currentValue, property.maxValue, property.isAboveFold));
            else
                newCharacter.properties.set(property.name, new Property(property.name, property.currentValue, property.isAboveFold));
        }

        //Effects
        var keys = Object.keys(character.effects);
        for (let i = 0; i < keys.length; i++) {
            let effect = character.effects[keys[i]];
            if (effect.duration == null)
                effect.duration = Infinity;
            newCharacter.effects[keys[i]] = effect;
        }

        return newCharacter;
    }

    constructor(name, owner, currentHP, maxHP, dataMessage) {
        this.name = name;
        this.owner = owner;
        this.HP = new PropertyRange('HP',currentHP, maxHP);     //Even though this is a property, it's special (especially for enemies) and putting it here means I don't always have filter it out when printing props later
        this.indent = ' '.repeat(name.length + 1);
        this.effects = {};
        this.properties = new Map();
        this.properties.set('HP', this.HP);
        this.linkedCharacters = {};     //Pets, familiars, shields, etc
        this.dataMessage = dataMessage; 
    }

    toJSON() {
        let foo = Object.assign({}, this);  //Copy this character object so when we whack the datamessage below we can still save later.
        foo.type = 'Character';
        foo.dataMessage = null;     //Discord message objects contain circular references that trip up JSON.stringify and we don't need to save all that garbage anyway.
        return foo;
    }

    resolveReference(stuff, roller) {
        //This will resolve [References] and return the resolved value
        //This includes lookups for other stats, and any dice rolls that are needed.
        //This is RECURSIVE!

        //Zeroth, if we have an int, just return it.
        if (Number.isInteger(stuff))
            return stuff;

        //First, resolve all references, because dice roller won't understand those
        let parsed = stuff.matchAll(Property.propertyReferencesRegex);

        //parsed[0] = full match including brackets
        //parsed[1] = name of stat only, no brackets
        for (const lookup of parsed) {
            let property = this.properties.get([lookup[1]].currentValue);
            stuff = stuff.replace(lookup[0],this.resolveReference(property, roller));
        }
        if (stuff.indexOf('{') !== -1) {
            stuff = stuff.replace('{','').replace('}','');
            return roller.roll(stuff).total;
        } else {
            return stuff;
        }
    }

    setHealth(currentHP, maxHP) {
        if (maxHP !== undefined)
            this.HP.maxValue = maxHP;
        else if (this.HP.maxValue == 0) {
            this.HP.maxValue = currentHP;       //Shortcut for new character creation so you can just say HP:300
        }

        if (currentHP < 0) {
            currentHP = 0;
        } else if (currentHP > this.HP.maxValue) {
            currentHP = this.HP.maxValue;
        }
        this.HP.currentValue = currentHP;
        
        return this;
    }

    setProperty(propertyName, value) {
        switch (propertyName) {             //Some props are so important they exist on the char object. Deal with those.
            case 'HP':
                this.setHealth(value);
                break;
            case 'initiative':
                this.properties.set('initiative', new Property('initiative', value));
                break;
            default:
                this.properties.set(propertyName, new Property(propertyName, value));
        }
        
        return this;
    }

    showCharacterSynopsis(channel) {
        let output = '```CSS\n';
        if (this.enemy) {
            output += `${this.name}: <${this.getAmbiguousHP()}>`;
        } else {
            output += `${this.name}: ${this.HP.currentValue}/${this.HP.maxValue}`;
        }

        for (let property of this.properties) {
            if (property.isAboveFold)
                output += ` ${property.toString()}`;
        }
        
        output += '\n';
        for (var effectName of Object.keys(this.effects)) {
            var effect = this.effects[effectName];
            output += `${this.indent} ${effectName} ${[getDurationText(effect.duration)]}\n`;
        }
        output += '```';
        return channel.send(output);
    }

    setPropertyRange(propertyName, currentValue, maxValue) {
        if (propertyName.toUpperCase() == 'HP')
            this.setHealth(currentValue,maxValue);
        else 
            this.properties.set(propertyName, new PropertyRange(propertyName, currentValue, maxValue));
        return this;
    }

    removeEffect(effectName) {
        delete this.effects[effectName];
        return this;
    }

    addEffect(effectName, durationString) {
        var durationInSeconds = 0;
        const durationRegex = /((?<duration>\d+) (?<durationUnits>(round|min|minute|hour|day|week))s?)/g;
        const durations = durationString.matchAll(durationRegex);
        for (const duration of durations) {
            switch (duration.groups.durationUnits) {
                case 'round':
                    durationInSeconds =+ duration.groups.duration * 6;
                    break;
                case 'min':
                case 'minute':
                    durationInSeconds =+ duration.groups.duration * 60;
                    break;
                case 'hour':
                    durationInSeconds =+ duration.groups.duration * 3600;
                    break;
                case 'day':
                    durationInSeconds =+ duration.groups.duration * 86400;
                    break;
                case 'week':
                    durationInSeconds =+ duration.groups.duration * 604800;
                    break;
                default:
                    console.error("Somehow got an invalid durationUnit past regex!");
            }
        }
        if (durationInSeconds == 0)
            durationInSeconds = Infinity;       //This means no duration was set, so it'll last until removed.

        if (this.effects[effectName]) {
            //Effect already exists. Compare durations. Highest duration stays
            this.effects[effectName].duration = Math.max(this.effects[effectName].duration, durationInSeconds);
        } else {
            this.effects[effectName] = {duration: durationInSeconds};
        }
    }
}

function getDurationText(duration) {
    if (duration === Infinity) {
        return '';
    } else if (duration >= 86400) {
        var foo = Math.round(duration/86400);
        return `${foo} day${(foo>1) ? 's':''}`;
    } else if (duration >= 3600) {
        var foo = Math.round(duration/3600);
        return `${foo} hour${(foo>1) ? 's':''}`;
    } else if (duration >= 60) {
        var foo = Math.round(duration/60);
        return `${foo} minute${(foo>1) ? 's':''}`;
    } else {
        var foo = Math.round(duration/6);
        return `${foo} round${(foo>1) ? 's':''}`;
    }
}

class Player extends Character {
    constructor(name,owner,currentHP,maxHP, dataMessage) {
        super(name, owner, currentHP,maxHP, dataMessage);
        this.enemy = false;
    }
}

class Enemy extends Character {
    constructor(name,owner,currentHP,maxHP,dataMessage) {
        super(name, owner, currentHP,maxHP,dataMessage);
        this.enemy = true;
    }

    getAmbiguousHP() {
        var percentage = this.HP.currentValue/this.HP.maxValue;
        if (percentage < .15) {
            return 'Critical';
        } else if (percentage < .5) {
            return 'Bloodied';
        } else if (percentage < 1) {
            return 'Injured';
        } else if (percentage == 1) {
            return 'Healthy';
        } else {
            return 'Error?';
        }
    }
}

class OmniTracker {
    static getBotDataMessages(message) {
        return new Promise(function(resolve, reject) {
            //First, look for existing data in the Bot Data channel. If we find it, use it. Else, create it.
            var botDataChannel = message.guild.channels.find(msg => msg.name == 'omni-data');
            if (!botDataChannel) {
                message.reply('Please use !omni setup first!');
            } else {
                botDataChannel.fetchMessages()
                .then(function(messages) {
                    let botDatum = [];
                    for (const msg of messages) {
                        let data = JSON.parse(msg[1].content);
                        data.message = msg[1];
                        botDatum.push(data);
                        if (data.type == 'OmniTracker')
                            var omniData = true;
                    }
                    if (!omniData) {
                        //No Omni Tracker data found. Create it!
                        let newOmniObject = { type: 'OmniTracker', date: 0, combat: null };
                        botDataChannel.send(JSON.stringify(newOmniObject))
                        .then(function (newBotDataMessage) {
                            newOmniObject.message = newBotDataMessage;
                            botDatum.push(newOmniObject);
                            resolve(botDatum);
                        });
                    } else {
                        resolve(botDatum);
                    }
                })
            }
        });
    }

    constructor (botData) {
        this.characters = {};
        this.time;
        this.combatCurrentInit = null;
        this.omniDataMessage = botData.omniData;
        this.combatDataMessage = botData.combatData;

        for (const data of botData) {
            switch (data.type) {
                case 'Character':
                    this.characters[data.name] = Character.importJSON(data);
                    if (this.characters[data.name].properties.get('initiative'))
                        this.combat = true;
                    break;
                case 'OmniTracker':
                    this.time = new Moment(data.date).utc();
                    this.combatCurrentInit = data.combatCurrentInit;
                    this.omniDataMessage = data.message;
                    break;
            }
        }
    }

    toJSON() {
        return { type: 'OmniTracker', date: this.time, combatCurrentInit: this.combatCurrentInit };
    }

    getDateText() {
        //Pathfinder's calendar is basically just ours with different names. Boring, but easy!
        var monthName;
        var dayName;
        var hourName;

        switch (this.time.month()) {
            case 0:
                monthName = 'Abadius';
                break;
            case 1:
                monthName = 'Calistril';
                break;
            case 2:
                monthName = 'Pharast';
                break;
            case 3:
                monthName = 'Gozran';
                break;
            case 4:
                monthName = 'Desnus';
                break;
            case 5:
                monthName = 'Sarenith';
                break;
            case 6:
                monthName = 'Erastus';
                break;
            case 7:
                monthName = 'Arodus';
                break;
            case 8:
                monthName = 'Rova';
                break;
            case 9:
                monthName = 'Lamashan';
                break;
            case 10:
                monthName = 'Neth';
                break;
            case 11:
                monthName = 'Kuthona';
                break;
        }

        //Days of week
        switch (this.time.day()) {
            case 0:
                dayName = 'Sunday';
                break;
            case 1:
                dayName = 'Moonday';
                break;
            case 2:
                dayName = 'Toilday';
                break;
            case 3:
                dayName = 'Wealday';
                break;
            case 4:
                dayName = 'Oathday';
                break;
            case 5:
                dayName = 'Fireday';
                break;
            case 6:
                dayName = 'Starday';
                break;
        }

        //Time of day. We stay vague, so hours is enough
        var hourNumber = this.time.hour();
        if (7 <=  hourNumber && hourNumber < 10 ) {
            hourName = 'Morning';
        } else if (10 <=  hourNumber && hourNumber < 12 ) {
            hourName = 'Late Morning';
        } else if (12 <=  hourNumber && hourNumber < 15 ) {
            hourName = 'Afternoon';
        } else if (15 <=  hourNumber && hourNumber < 19 ) {
            hourName = 'Evening';
        } else if (19 <=  hourNumber && hourNumber < 20 ) {
            hourName = 'Dusk';
        } else if (20 <=  hourNumber && hourNumber < 24 ) {
            hourName = 'Night';
        } else if (hourNumber < 7 ) {
            hourName = 'Night';
        } else if (6 <=  hourNumber && hourNumber < 7 ) {
            hourName = 'Dawn';
        } else {
            hourName = 'Error!';
        }

        return `{${dayName}, ${this.time.date()} ${monthName}; ${hourName}}`;
    }

    sortCharsByInit() {
        //Will return a sorted array of keys.
        var foo = this.characters;
        return Object.keys(foo).sort(function (a,b){ 
            if (foo[a].properties.get('initiative') === undefined) {
                return 1;
            } else if (foo[b].properties.get('initiative') === undefined) {
                return -1;
            }
            if (foo[a].properties.get('initiative').currentValue == foo[b].properties.get('initiative').currentValue) {
                if (foo[a].enemy) {
                    return -1;   //Enemies go first in PF2 and if they're both enemies or both PCs than who cares
                } else {
                    return 1;
                }
            } else {
                return foo[b].properties.get('initiative').currentValue - foo[a].properties.get('initiative').currentValue;
            }
        });
    }

    increaseTimeForCharacter(increaseInSeconds, character, message) {
        //Combat is weird in that while a round is 6 seconds, effects don't end at the end of the round, rather the start of the character turn.
        //So we need to treat combat different, and only increase time for one character's effects at start of their turn when in combat.
        var expiredEffectsMessage = '';
        for (let effectName in character.effects) {
            let effect = character.effects[effectName];
            effect.duration -= increaseInSeconds;
            if (effect.duration <= 0) {
                expiredEffectsMessage += `<@${character.owner}>, ${effectName} has ended on ${character.name}.\n`;
                delete character.effects[effectName];
            }
        }
        if (expiredEffectsMessage) {
            message.channel.send(expiredEffectsMessage)
            .catch(console.error);
        }
        return expiredEffectsMessage;
    }

    increaseTime(stringDuration, message) {
        const timeRegex = /(?<duration>(?<durationValue>\d+) ?(?<durationUnits>(minute|min|sec|second|hour|day|week|month))s?)|(?<specific>\d?\d:\d\d)|(?<abstract>(midnight|dawn|morning|noon|dusk|night|tomorrow|evening))/i;
        const parsed = stringDuration.match(timeRegex);
        const oldTime = new Moment(this.time).utc();

        //min and sec aren't natively supported, so lets do a quick translate
        if (/mins?/.test(parsed.groups.durationUnits)) {
            parsed.groups.durationUnits = 'minute';
        } else if (/secs?/.test(parsed.groups.durationUnits)) {
            parsed.groups.durationUnits = 'second';
        }

        if (parsed.groups.duration) {
            var duration = Moment.duration(parseInt(parsed.groups.durationValue), parsed.groups.durationUnits);
            this.time.add(duration);
        } else if (parsed.groups.specific) {
            var duration = Moment.duration(parsed.groups.specific);
            this.time.add(duration);
        } else if (parsed.groups.abstract){
            switch (parsed.groups.abstract.toUpperCase()) {
                case 'TOMORROW':
                case 'MORNING':
                    if (this.time.hour() > 7) {
                        this.time.add(1,'day').hour(7).minute(0).second(0);
                    } else {
                        this.time.hour(7).minute(0).second(0);
                    }
                    var duration = Moment.duration(this.time.diff(oldTime));
                    break;
                default:
                    message.reply(`Sorry, I don't know how to set time to ${parsed.groups.abstract} yet.`).catch(console.error);
                    break;
            }
        }
        let increaseInSeconds = duration.asSeconds();
        message.reply(`Forwarding time ${oldTime.from(this.time, true)}`)
        .catch(console.error);

        for (let characterName in this.characters) {
            const character = this.characters[characterName];
            this.increaseTimeForCharacter(increaseInSeconds, character, message);
        }
    }

    saveBotData() {
        //Saves the data to the bot channel
        this.omniDataMessage.edit(JSON.stringify(this))
        .catch(console.error);

        for (var characterName in this.characters) {
            const character = this.characters[characterName];
            const json = JSON.stringify(character);

            if (!character.dataMessage) {
                this.omniDataMessage.channel.send(json)
                    .then(message => {
                        character.dataMessage = message;
                    })
                    .catch(console.error);
            
            } else {
                character.dataMessage.edit(json)
                .catch(console.error);
            }
        }
    }

    updateTrackers() {
        //Search all channels in this guild for Omni Trackers and update them.
        let updatedTracker = this.generateOmniTrackerMessageText();
        let updatedGMTracker = this.generateOmniTrackerMessageText(true);
        for (var channel of this.omniDataMessage.guild.channels) {
            if (channel[1].type == 'text') {
                channel[1].fetchPinnedMessages()
                .then(messages => {
                    for (var msg of messages) {
                        if (msg[1].content.startsWith('```CSS\n[Omni Tracker]')) {
                            msg[1].edit(updatedTracker)
                            .catch(console.error);
                        } else if (msg[1].content.startsWith('```CSS\n[Omni GM Tracker]')) {
                            msg[1].edit(updatedTracker)
                            .catch(console.error);
                        }
                    }
                })
                .catch(console.error)
            }
        }
    }

    showTrackerInChannel(message) {
        return message.channel.send(this.generateOmniTrackerMessageText());
    }

    generateOmniTrackerMessageText(isGMTracker) {
        if (isGMTracker)
            var output = '```CSS\n[Omni GM Tracker]\n';
        else 
            var output = '```CSS\n[Omni Tracker]\n';

        output += this.getDateText() + '\n\n';
        var characters = Object.keys(this.characters);
        if (this.combat) {
            var combatIndent = '     | ';
            //Need to sort by init
            characters = this.sortCharsByInit();
        } else {
            var combatIndent = '';
        }

        for (var characterName in characters) {
            var character = this.characters[characters[characterName]];       //ugh, again
            if (this.combat) {
                if (character.properties.get('initiative') === undefined) {
                    var init = '  ';
                } else if (character.properties.get('initiative').currentValue < 10) {
                    //Indent one space to make small inits line up with bigger ones. Presuming they never get over 100...
                    var init = ` ${character.properties.get('initiative').currentValue}`;
                } else {
                    var init = `${character.properties.get('initiative').currentValue}`;
                }
                if (this.combatCurrentInit == character.name) {
                    output += `> ${init} | `;
                } else {
                    output += `  ${init} | `;
                }
            }
            if (character.enemy == false || isGMTracker) {
                output += `${character.name}: ${character.HP.currentValue}/${character.HP.maxValue}`;
            } else {
                output += `${character.name}: <${character.getAmbiguousHP()}>`;
            }

            for (let property of character.properties) {
                if (property.isAboveFold)
                    output += ` ${property.toString()}`;
            }
            
            output += '\n';
            for (var effectName of Object.keys(character.effects)) {
                var effect = character.effects[effectName];
                output += `${combatIndent}${character.indent} ${effectName} ${[getDurationText(effect.duration)]}\n`;
            }
            
        }

        return output + '```';
    }

    getCharacterFromAuthorID(ID) {
        //Given the Discord ID, return the first character they own.
        for (var characterName in this.characters) {
            if (this.characters[characterName].owner == ID)
                return this.characters[characterName];
        }
    }
}

function gmOnlyCommand(message) {
    //Called when a command is deemed dangerous and we want to limit its usage to users with the GM role only.
    //return true;
    return new Promise(function(resolve, reject) {
        //throw "You're not a GM. Go away."
        resolve();
    });
}

const omniCommandRegex = /^!omni (?<verb>\w+) (?<noun>\w+) (?<target>('.+?'|%?\w+)) ?(?<properties>.*)?$/;
function handleCommand(message) {
    
    //Mobile phones like putting a space after the ! for some reason. To make it easier on mobile users, remove that.
    if (message.content.startsWith('! '))
        message.content = message.content.replace(/^! /,'!');

    const keyword = message.content.match(botCommandRegex).groups.keyword;
    switch (keyword) {
        case 'omni help':
            message.author.send(helpMessage)
            .then(function() {
                message.author.send(exampleHelpMessage);
            })
            .then(function() {
                message.author.send(gmHelpMessage);
            })
            .catch(console.error);
            return; //Return so we don't trigger the omni commands below.
        case 'omni setup':
            handleOmniSetup(message);
            return;
        case 'r':
        case 'roll':
            handleRollCommands(message);
            break;
        case 'heal':
        case 'damage':
            handleChangingHP(message);
            break;
        case 'next':
            handleInitNextCommand(message);
            break;
        case 'init':
            if (message.content == '!init') {
                message.content = '!roll init:[Perception]';
                handleRollCommands(message);
            } else {
                let parsed = message.content.match(/!init (?<skill>\w+)/);
                if (parsed) {
                    message.content = `!roll init:[${parsed.groups.skill}]`;
                    handleRollCommands(message);
                }
            }
            break;
        case 'time':
            let parsedCommand = message.content.match(/^! ?time (?<properties>.+)$/);
            parsedCommand.groups.verb = 'add';
            handleTimeCommands(parsedCommand, message);
            break;
        case 'omni':
            const command = message.content.match(omniCommandRegex);
            if (!command) {
                message.reply('Invalid !omni command. Use !omni help if needed.')
                .catch(console.error);
                return;
            }

            switch (command.groups.noun) {
                case 'enemy':
                case 'player':
                    handlePlayerCommands(command, message);
                    break;
                case 'tracker':
                    handleTrackerCommands(command, message);
                    break;
                case 'effect':
                    handleEffectCommands(command, message);
                    break;
                case 'time':
                    handleTimeCommands(command, message);
                    break;
                case 'stat':
                case 'property':
                    handlePropertyCommands(command, message);
                    break;
                default:
                    message.reply('Invalid !omni command. Use !omni help if needed.')
                    .catch(console.error);
            
            }
            break;
    }
    
    
}

function handleTrackerCommands(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            gmOnlyCommand(message);
            message.channel.fetchPinnedMessages()
            .then(function(pinnedMessages) {
                for (var pinnedMessage of pinnedMessages) {
                    if (pinnedMessage[1].content.startsWith('```CSS\n[Omni Tracker]')) {
                        //Found the data.
                        return pinnedMessage[1].delete();
                    }
                }
                throw('Could not find a tracker to remove!');
            })
            .catch(console.error);
            break;
    
        case 'add':
            gmOnlyCommand(message);
            OmniTracker.getBotDataMessages(message)
            .then(function(data){
                //Using the data, we can now construct an Omni Tracker class object and use it to
                //create the message and pin it.
                let isGMTracker = false;
                if (command.groups.properties == 'GM')
                    isGMTracker = true;

                omniTracker = new OmniTracker(data);
                return message.channel.send(omniTracker.generateOmniTrackerMessageText(isGMTracker));
            })
            .then(function(newMessage) {
                return newMessage.pin();
            })
            .catch(console.error);    
            break;
        case 'show':
            OmniTracker.getBotDataMessages(message)
            .then(function(data){
                //Using the data, we can now construct an Omni Tracker class object and use it to
                //create the message and pin it.
                omniTracker = new OmniTracker(data);
                return message.channel.send(omniTracker.generateOmniTrackerMessageText());
            })
            .catch(console.error);    
            break;
        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);
    }
}

function handlePlayerCommands(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            gmOnlyCommand(message)
            .then(function() {
                return OmniTracker.getBotDataMessages(message);
            })
            .then(data => {
                var tracker = new OmniTracker(data);
                let promises = [];
                if (command.groups.target == '%enemies') {
                    for (characterName in tracker.characters) {
                        let character = tracker.characters[characterName];
                        if (character.enemy) {
                            promises.push(character.dataMessage.delete());
                        }
                    }
                } else {
                    let character = tracker.characters[command.groups.target];
                    if (character) {
                        promises.push(character.dataMessage.delete());
                    } else {
                        message.reply(`Couldn't find a character with the name ${command.groups.target}. Please check your spelling!`)
                        .catch(error => {
                            console.error(error);
                        })
                        return;
                    }
                }
                //Now that everything is being deleted, wait and update the channel when done.
                Promise.all(promises).then(data => {
                    return OmniTracker.getBotDataMessages(message)
                }).then(data => {
                    var tracker = new OmniTracker(data);
                    tracker.showTrackerInChannel(message);
                })
            })
            .catch(error => {
                message.reply(error);
                console.error(error);
            })
            break;
        case 'add':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace(/'/g,"");
                const propertiesRegex = /(?<propertyName>\w+):((?<propertyMinValue>\d+)(\/|\\)(?<propertyMaxValue>\d+)|(?<propertyValue>\S+))/g;
                if (command.groups.noun == 'player') {
                    tracker.characters[characterName] = new Player(characterName, message.author.id, 0, 0);    //HP will hopefully get set in the properties below. And if not, 0/0 will prompt the user.
                } else if (command.groups.noun == 'enemy') {
                    gmOnlyCommand();
                    tracker.characters[characterName] = new Enemy(characterName, message.author.id, 0, 0);
                }
                let character = tracker.characters[characterName];
                if (command.groups.properties) {
                    var properties = command.groups.properties.matchAll(propertiesRegex);
                    for (let property of properties) {
                        if (property.groups.propertyValue) {
                            let roller = new DiceRoller();
                            character.setProperty(property.groups.propertyName, character.resolveReference(property.groups.propertyValue, roller));
                            if (roller.log.length > 0) {
                                message.reply(`${roller}`);
                            }
                        } else {
                            character.setPropertyRange(property.groups.propertyName, property.groups.propertyMinValue, property.groups.propertyMaxValue);
                        }
                    }
                }
                tracker.saveBotData();
                tracker.updateTrackers();
                message.reply(`Added new character ${characterName}`);
                tracker.characters[characterName].showCharacterSynopsis(message.channel);
            })
            .catch(error => {
                message.reply('Sorry, there was an error. Check your syntax!');
                console.error(error);
            });
            break;
        case 'show':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                let character = tracker.characters[command.groups.target];
                if (character && !character.enemy) {
                    let output = '```JSON\n';
                    output += `Name: ${character.name}\n\n`;
                    for (let property of character.properties) {
                        output += `${property}\n`;
                    }
                    output += '```';
                    message.reply(output).catch(error => {console.error(error)});
                } else {
                    message.reply(`Couldn't find a player with the name ${command.groups.target}. Please check your spelling!`)
                    .catch(error => {
                        console.error(error);
                    })
                    return;
                }
            })
            .catch(error => {
                message.reply('Ooops! Something went wrong. Double check your syntax!');
                console.error(error);
            })
            break;

        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);
    }
}

function handleEffectCommands(command, message) {
    switch (command.groups.verb) {
        case 'add':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace(/'/g,"");
                const effectRegex = /^(?<effectName>('.+?'|\w+))(?<durationInfo>.*)$/i;

                let effect = command.groups.properties.match(effectRegex);
                if (effect) {
                    switch (command.groups.target) {
                        case '%players':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                if (!character.enemy) {
                                    character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                    character.showCharacterSynopsis(message.channel);
                                }
                            }
                            break;
                        case '%enemies':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                if (character.enemy) {
                                    character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                    character.showCharacterSynopsis(message.channel);
                                }
                            }
                            break;
                        case '%all':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                character.showCharacterSynopsis(message.channel);
                            }
                            break;
                        default:
                            tracker.characters[characterName].addEffect(effect.groups.effectName, effect.groups.durationInfo);
                            tracker.characters[characterName].showCharacterSynopsis(message.channel);
                            break;
                    }
                    tracker.saveBotData();
                    tracker.updateTrackers();
                } else {
                    message.reply('Invalid effect command.')
                    .catch(console.error);
                }
            })
            .catch(console.error);
            break;
        case 'remove':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    var tracker = new OmniTracker(data);
                    var characterName = command.groups.target.replace(/'/g,"");
                    const effectRegex = /^(?<effectName>('.+?'|\w+))$/;
                    
                    let effect = command.groups.properties.match(effectRegex);

                    if (effect) {
                        switch (command.groups.target) {
                            case '%players':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    if (!character.enemy) {
                                        character.removeEffect(effect.groups.effectName);
                                        character.showCharacterSynopsis(message.channel);
                                    }
                                }
                                break;
                            case '%enemies':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    if (character.enemy) {
                                        character.removeEffect(effect.groups.effectName);
                                        character.showCharacterSynopsis(message.channel);
                                    }
                                }
                                break;
                            case '%all':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    character.removeEffect(effect.groups.effectName);
                                    character.showCharacterSynopsis(message.channel);
                                }
                                break;
                            default:
                                tracker.characters[characterName].removeEffect(effect.groups.effectName);
                                tracker.characters[characterName].showCharacterSynopsis(message.channel);
                                break;
                        }
                        tracker.saveBotData();
                        tracker.updateTrackers();
                    } else {
                        message.reply('Invalid effect command.')
                        .catch(console.error);
                    }


                    
                    
                })
                .catch(console.error);
                break;

        default:
                message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
                .catch(console.error);

    }
}

function handleTimeCommands(command, message) {
    gmOnlyCommand(message)
    .then(function() {
        switch (command.groups.verb) {
            case 'add':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    var tracker = new OmniTracker(data);
    
                    tracker.increaseTime(command.groups.properties, message);
                    tracker.saveBotData();               
                    tracker.updateTrackers();
                })
                .catch(console.error);
                break;
        
                default:
                    message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
                    .catch(console.error);
    
        }  
    })
}

function handlePropertyCommands(command, message) {
    switch (command.groups.verb) {
        case 'set':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace(/'/g,"");
                const propertiesRegex = /(?<propertyName>\w+):((?<propertyMinValue>\d+)(\/|\\)(?<propertyMaxValue>\d+)|(?<propertyValue>(=?(\w|\[|\]|\{|\}|\+|-)+)))/g;
                if (tracker.characters[characterName]) {
                    var properties = command.groups.properties.matchAll(propertiesRegex);
                    for (let property of properties) {
                        property.groups.propertyName = Property.translateAliasedPropertyNames(property.groups.propertyName);
                        if (property.groups.propertyValue) {
                            if (property.groups.propertyValue.startsWith('=')) {
                                property.groups.propertyValue = property.groups.propertyValue.replace('=','');   
                            } else {
                                let roller = new DiceRoller();
                                property.groups.propertyValue = tracker.characters[characterName].resolveReference(property.groups.propertyValue, roller);
                                if (roller.log.length > 0) {
                                    message.reply(`${roller}`);
                                }
                            }
                            tracker.characters[characterName].setProperty(property.groups.propertyName, property.groups.propertyValue);
                            message.reply(`${characterName} ${tracker.characters[characterName].properties.get(property.groups.propertyName)}`);
                        } else {
                            tracker.characters[characterName].setPropertyRange(property.groups.propertyName, property.groups.propertyMinValue, property.groups.propertyMinValue);
                            message.reply(`${characterName} ${tracker.characters[characterName].properties.get(property.groups.propertyName)}`);
                        }
                    }
                    tracker.saveBotData();
                    tracker.updateTrackers();
                } else {
                    message.reply(`Player ${command.groups.target} could not be found.`)
                    .catch(console.error);
                }
            })
            .catch(error => {
                console.error(error);
                message.reply('Sorry, an error was encountered. Please check your command!');
            });
            break;

        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);

    }  
}

const rollCommandRegex = /^!r(oll)? (((?<destinationStat>\w+):)?)?(?<sourceStat>.+)/;
const diceNotationRegex = /^!r(oll)? (?<diceNotation>.+)$/;
function handleRollCommands(message) {
    const command = message.content.match(rollCommandRegex);
    let roller = new DiceRoller();

    if (!command) {
        message.reply('Invalid command!')
        .catch(console.error);
    } else {
        OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                //Get the character for the message author so we know who's stat to roll
                character = tracker.getCharacterFromAuthorID(message.author.id);
                const output = character.resolveReference(command.groups.sourceStat, roller)*1;
                if (!Number.isInteger(output)) {
                    throw "Invalid reference.";
                }
                if (command.groups.destinationStat) {
                    character.setProperty(command.groups.destinationStat, output);
                    message.reply(`${command.groups.destinationStat} has been set to ${output} on character ${character.name}\n${roller}`)
                    .catch(console.error);
                } else {
                    message.reply(`${command.groups.sourceStat} is ${output} on character ${character.name}\n${roller}`)
                    .catch(console.error);
                }
                tracker.saveBotData();
                tracker.updateTrackers();
            })
            .catch(error => {
                //If the above was an error, it's probably straight dice notation
                notation = message.content.match(diceNotationRegex);
                try {
                    roller.roll(notation.groups.diceNotation);
                    message.reply(`${roller}`);
                } catch(error){
                    console.error(error)
                    message.reply('Invalid roll command!')
                    .catch(console.error);
                }
            });
        
    }
}

function handleInitNextCommand(message) {
    gmOnlyCommand();
    OmniTracker.getBotDataMessages(message)
            .then(data => {
                let tracker = new OmniTracker(data);

                let sortedCharacterNames = tracker.sortCharsByInit();
                if (tracker.combatCurrentInit === undefined) {
                    tracker.combatCurrentInit = sortedCharacterNames[0];
                } else {
                    for (let i = 0; i < sortedCharacterNames.length; i++) {
                        if (sortedCharacterNames[i] == tracker.combatCurrentInit) {
                            if (i+1 >= sortedCharacterNames.length || tracker.characters[sortedCharacterNames[i+1]].properties.get('initiative') == undefined) {      //Are we at the end of the list?
                                tracker.combatCurrentInit = sortedCharacterNames[0];                                                                            //Reached end of character list, wrap around
                            } else {
                                tracker.combatCurrentInit = sortedCharacterNames[i+1];
                            }
                            break;  //Don't need to keep looking, we get what we needed
                        }
                    }
                }
                tracker.increaseTimeForCharacter(6, tracker.characters[tracker.combatCurrentInit], message);
                message.channel.send(`Hey <@${tracker.characters[tracker.combatCurrentInit].owner}> it's your turn!`);

                tracker.saveBotData();
                tracker.updateTrackers();
                tracker.showTrackerInChannel(message);
            })
            .catch(error => {
                console.error(error);
                message.reply('Something went wrong when changing init. What did you do?!')
                .catch(console.error);
            });
}

const changeHpRegex = /^!(?<heal_or_damage>(heal|damage)) (?<target>('.+?'|\w+)) (?<delta>\d+)$/i;

function handleChangingHP(message) {
    OmniTracker.getBotDataMessages(message)
        .then(data => {
            let tracker = new OmniTracker(data);
            let parsed = message.content.match(changeHpRegex);

            if (!parsed) {
                message.reply('Invalid command syntax!');
                return;
            }

            if (parsed.groups.heal_or_damage == 'damage') {
                parsed.groups.delta *= -1;      //Damage is just negative healing!
            } else {
                parsed.groups.delta *= 1;       //Force to a number
            }

            let character = tracker.characters[parsed.groups.target]
            if (character == undefined) {
                message.reply(`Could not find a character with that name!`);
                return;
            } else {
                character.setHealth(character.HP.currentValue + parsed.groups.delta);
                tracker.saveBotData();
                tracker.updateTrackers();
                character.showCharacterSynopsis(message.channel);
            }
        });   
}

function handleOmniSetup(message) {
    const channelCategoryName = 'PF2e Helper Bot Data';
    const dataChannelName = 'omni-data';
    let gmRole = message.guild.roles.find(role => role.name == 'GM');
    let botChannelCategory = message.guild.channels.find(category => category.name == channelCategoryName);
    let botDataChannel = message.guild.channels.find(msg => msg.name == dataChannelName);

    if (!gmRole) {
        message.guild.createRole({name: 'GM'}).catch(error => {console.error(error)});
    }

    new Promise(function(resolve, reject) {
        if (botChannelCategory) {
            resolve(botChannelCategory);
        } else {
            resolve (message.guild.createChannel(channelCategoryName, {
                type: 'category',
                permissionOverwrites: [{
                    id: message.guild.id,
                    deny: ['READ_MESSAGES']
                },
                {
                    id: message.client.user,
                    allow: ['READ_MESSAGES']
                }],
            }));
        }
    })
    .then(categoryChannel => {
        if (botDataChannel) {
            return botDataChannel;
        } else {
            return message.guild.createChannel(dataChannelName, {
                type: 'text',
                parent: categoryChannel
            })
        }
    })
    .then(console.log)
    .catch(console.error);
}