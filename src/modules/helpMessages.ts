export default class HelpMessages{

    static general: string = `
    \`\`\`
    Most commands follow the '!omni <verb> <noun> <target> <properties>' pattern
    Verbs: add, set, remove, show, roll
    Nouns: tracker, player, effect, enemy, time, shield, property, owner
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

    Also, stats can use {dice notation} and references to other stats. Just like in spreadsheets, prefixing with an equals sign
    denotes a formula. For example, adding a dynamic stat called Perception could be written like:
    !omni set stat Bob Perception:={1d20}+Expert+WIS

    After, you can do things like '!roll init:Perception' to roll your perception and set your initiative to the result. Fancy! Or even just '!init perception'
    If you don't like being fancy, '!roll init:{1d20+7}' still works.

    # Special / Reserved stats:
    HP: Character health
    Initiative: The chracter's rolled initiative for combat, used in tracker order
    TempHP: Temporary HP. These will be consumed first when damage is dealt.
    \`\`\`
    `;

    static example: string = `
    \`\`\`
    Examples:

    !omni help                                      (Displays this.)
    !omni add tracker here players                  (Create an omni tracker for players in this channel.)
    !omni add player Bob AC:10 HP:18/20             (Add a new player Bob controlled by the person who typed the command.)
    !omni remove player Bob                         (Add a new player Bob controlled by the person who typed the command.)
    !omni set player Bob AC:20 HP:15/30             (Set Bob's AC to 20 and current HP to 15 of 30.)
    !omni add effect Bob Frightened 5+ rounds       (Make Bob dizzy for 5 rounds. The + causes the duration to decrease at end of turn instead of beginning.)
    !omni add effect Bob sick 2 days                (Makes Bob sick for 2 days.)
    !omni remove effect Bob Dizzy                   (Remove Dizzy from Bob prematurely)
    !omni add effect %players Inspired 1 round      (Gives all PCs the Inspired effect)
    !omni add effect %all 'On Fire' 1 round         (Makes enemies and players on fire)
    !omni add effect %enemies Dumb 1 round          (Gives all enemies the dumb effect)
    !omni set stat Bob init:7                       (Sets Bob's initiatve to 7)
    !omni set stat Bob init:Perception              (Computes bob's perception and sets his init to that value)
    \`\`\`
    `;

    static gm: string = `
    \`\`\`
    GM Commands:

    !omni add tracker here GM                   (Create a GM omni tracker in this channel. GM Trackers show more info than normal trackers, like enemy health.)
    !omni add enemy 'War Boss' AC:40 HP:300/300 Init:{1d20+10}
    !omni add time tracker 10min                (Moves time forward by 10 minutes)
    !omni add time tracker 5 hours
    !omni set time tracker tomorrow             (Moves time forward until it's tomorrow morning)
    !omni set time tracker 13:00                (Moves time forward until it's 1pm)
    !omni set stat init Bob 15                       (Change Bob's initiative to 15)
    !omni set stat init Bob 15.1                     (Change Bob's initiative to 15.1, useful when players tie for initiative.)
    !next                                       (When in combat, move to next character's turn)
    !omni set owner Bob @Bob                    (Sets the controller of the character to a specific user in Discord)
    !omni roll stat Bob Perception+{1d4}        (Rolls Bob's perception stat and adds 1d4 to it)
    \`\`\`
    `;
};