# This is an extremely quick and dirty python script which will take a character built in
# PathBuilder and exported as JSON and generate a bot command to help import them.
# The output will give a new player a good start, but the output is meant to be customized.
# Some things had to be guessed, like ability score bonuses for casting skills.
# It takes exactly one command line parameter: the URL of the JSON exported character from Pathbuilder.

# What's supported:

# Skills and profs
# Ability scores
# Weapons
# Misc stuff like AC, HP, Level, and common bot stats to help tie things together

import urllib.request
from urllib.request import Request
from urllib.request import urlopen
import json
from math import trunc
import sys

skillMods = {
    "perception": "Wis",
    "fortitude": "Con",
    "reflex": "Dex",
    "will": "Wis",
    "castingArcane": "Int",
    "castingDivine": "Wis",
    "castingOccult": "Cha",
    "castingPrimal": "Wis",
    "acrobatics": "Dex",
    "arcana": "Int",
    "athletics": "Str",
    "crafting": "Int",
    "deception": "Cha",
    "diplomacy": "Cha",
    "intimidation": "Cha",
    "medicine": "Wis",
    "nature": "Wis",
    "occultism": "Int",
    "performance": "Cha",
    "religion": "Wis",
    "society": "Int",
    "stealth": "Dex",
    "survival": "Wis",
    "thievery": "Dex"

}

def getResponse(url):
    raw_request = Request(url)
    raw_request.add_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:78.0) Gecko/20100101 Firefox/78.0')
    raw_request.add_header('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
    resp = urlopen(raw_request)
    if(resp.getcode()==200):
        data = resp.read()
        jsonData = json.loads(data)
    else:
        print("Error receiving data", operUrl.getcode())
    return jsonData

def numToTrained(num):
    if num == 0: return "U"
    if num == 2: return "T"
    if num == 4: return "E"
    if num == 6: return "M"
    if num == 8: return "L"

def main():

    #urlData = "https://pathbuilder2e.com/json.php?id=115132"
    if len(sys.argv) < 2:
        print("No URL given. Whata do you want me to import without it?!")
        exit(1)
    url = sys.argv[1]
    jsonData = getResponse(url)

    build = jsonData["build"]
    name = build["name"].split(' ',1)[0]
    hp = trunc(((build["attributes"]["ancestryhp"] + build["attributes"]["classhp"] + (build["abilities"]["con"]/2)-5 + build["attributes"]["bonushpPerLevel"]) * build["level"]) + build["attributes"]["bonushp"])
    output = f"!omni set stat {name} HP:{hp}/{hp} level:{build['level']} U:=1d20 T:=1d20+Level+2 E:=1d20+Level+4 M:=1d20+Level+6 L:=1d20+Level+8 !AC:{build['acTotal']['acTotal']}"
    
    for skill in build["abilities"]:
        value = trunc((build['abilities'][skill]/2)-5)
        output = output + f" {skill}:{value}"

    for prof in build["proficiencies"]:
        value = numToTrained(build["proficiencies"][prof])
        output = output + f" {prof}:={value}"
        if prof in skillMods:
            output = output + "+" + skillMods[prof]

    for weapon in build["weapons"]:
        name = weapon["display"].replace(' ','')
        if name.endswith('e'):
            suffix = "d"
        else:
            suffix = "ed"
        output = output + f" {name}:={weapon['prof']}+str {name}{suffix}:=1{weapon['die']}+str"

    print(output)
if __name__ == '__main__':
    main()
