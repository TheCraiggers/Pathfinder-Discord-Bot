const captureWebsite = require('capture-website');
const curl = require('curlrequest');
const tmp = require('tmp');
const makeDir = require('make-dir');
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile);
const path = require('path');
const css = `
:root {
    --mainColor: #4F0000; /*sealBrown*/
    --backMainColor: #F5F4F2; /*floralWhite*/
    --backTraits: #d9c484; /*Zombie*/
    --rojoNormal:#5e0000; /*Maroon*/
    --rojoTitulo:#c74a1b;
    --fondoBloques:#eae4d8;
    --bordeBloques:#c99a89;
    --tablaCabeza:#5e0000;
    --tablaPar:#f5efe0;
    --tablaImpar:#ede3c8;
    --tablaFoot:#e6d8b0;
    --tablaExtra:#dfce9a;
    --encabezado2:#a86753;
    --bordeAmarillo:#b29e74;
    --link:#c74a1b;
    --link2:#138953;
    --link3:#185580;
    --link4:#c77c1b;
    --rarity:#98513d;
    --rare:#002664;
    --settlement:#004416;
    --unique:#54166e;
    --size:#3b7b59;
    --alignment:#576293;
    --fondoBox:#dbd1bc;
    --fondoSidebar:#cfc3ad;
    --fondoResaltar2:#d0c5af;
    --lightBlue: #d1d3d4;
    --sizeDice:1;
  }
@font-face {
  font-family: 'SabonLTSstd';
  src: url('/fonts/SabonLTStd-Roman.woff2') format('woff2'),
       url('/fonts/SabonLTStd-Roman.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'olsentf';
  src: url('/fonts/olsentf-regular-webfont.woff2') format('woff2'),
       url('/fonts/olsentf-regular-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'sketch_gothic_schoolregular';
  src: url('/fonts/sketch_gothic_school-webfont.woff2') format('woff2'),
       url('/fonts/sketch_gothic_school-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'wolf_in_the_cityregular';
  src: url('/fonts/wolf_in_the_city-webfont.woff2') format('woff2'),
       url('/fonts/wolf_in_the_city-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'knemabold';
  src: url('/fonts/knema-webfont.woff2') format('woff2'),
       url('/fonts/knema-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Pathfinder_Icons';
  src: url('/fonts/Pathfinder-Icons.woff2') format('woff2'),
       url('/fonts/Pathfinder-Icons.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'GoodOT_CondBold';
  src: url('/fonts/GoodOT-CondBold.woff2') format('woff2'),
       url('/fonts/GoodOT-CondBold.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'GoodOT_Bold';
  src: url('/fonts/goodot-bold-webfont.woff2') format('woff2'),
       url('/fonts/goodot-bold-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Taroca';
  src: url('/fonts/taroca-webfont.woff2') format('woff2'),
       url('/fonts/taroca-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'GoodOT';
  src: url('/fonts/goodot-webfont.woff2') format('woff2'),
       url('/fonts/goodot-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'albertus_mt';
  src: url('/fonts/albertus_mt.woff2') format('woff2'),
       url('/fonts/albertus_mt.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'moonshiner';
  src: url('/fonts/moonshiner-regular-webfont.woff2') format('woff2'),
       url('/fonts/moonshiner-regular-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-variant: small-caps;
}
@font-face {
  font-family: 'SabonItalic';
  src: url('/fonts/SabonLTStd-Italic.woff2') format('woff2'),
       url('/fonts/SabonLTStd-Italic.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-variant: small-caps;
}

.lightMode {
  display: none !important;
}

i.pf2:before {
  font-family: 'Pathfinder_Icons';
  font-style:normal;
  font-size:0.9em;
}
i.pf2.action1:before { content: " "; }
i.pf2.action2:before { content: " "; }
i.pf2.action3:before { content: " "; }
i.pf2.actionF:before { content: " "; }
i.pf2.Reaction:before { content: " "; }

.tooltip{
  font-size: calc(10 * var(--midaLetra) / 18);
}
*{
   font-family: 'SabonLTSstd';
  box-sizing: border-box;
}
html {
min-height: 100%;
position: relative;
}
body {
margin: 0;
margin-bottom: 70px;
background-color:  var(--backMainColor);
}
footer.principal{
    position: absolute;
    bottom: 0;
    left:0;
    width: 100%;
    height: 60px;
    color:var(--mainColor);
    font-size: calc(1 * var(--midaLetra) / 2);
}
/*MODALS*/
h3.modal-title strong{
  font-family: 'knemabold';
}
.modal-body > ul{
  padding-left: 0;
}
/*BARRA TITULO*/
h1.mainTitle{
  cursor:pointer;
}
h1.mainTitle > span{
  font-family: 'sketch_gothic_schoolregular';
  color:var(--mainColor);
  font-size:calc(1.3 * var(--midaLetra));
  /*cursor:context-menu;*/
}
h1.mainTitle > span.special{
  font-family: 'wolf_in_the_cityregular';
  color:#a23424; 
  font-size:var(--midaLetra);
  margin-right: calc(1 * var(--midaLetra) / 36);

  text-shadow:  calc(1 * var(--midaLetra) / 90)  calc(1 * var(--midaLetra) / 90) 0px rgba(0,0,0,0.2);
}
/*MENU DE LINKS*/
aside.linkR{
  position: absolute;
  right:calc(1 * var(--midaLetra) / 6);
  top:calc(1 * var(--midaLetra) / 6);
}
aside.linkR nav.dropdown-menu{
  width: calc(70 * var(--midaLetra) / 9) !important;
  font-size:calc(5 * var(--midaLetra) / 6);
}
aside.linkR nav > a{
  padding:calc(2 * var(--midaLetra) / 9) calc(5 * var(--midaLetra) / 9);
}
aside.linkR span{
  font-family: 'knemabold';
  margin-right: calc(5 * var(--midaLetra) / 9);
}

/*BARRA DE BUSQUEDA*/
#text_search {
  position:relative;
  font-size:calc(7 * var(--midaLetra) / 9);
  background: white url(/img/search-light.svg) no-repeat calc(100% - 10px) center;
  background-size:  auto 50%;
}
/*RESULTADOS BUSQUEDA*/
#list-results{
  font-size:calc(11 * var(--midaLetra) / 18);
  padding-left:calc(5 * var(--midaLetra) / 18);
}
button.listado > small{
  font-family: 'GoodOT_Bold';
  text-transform: uppercase;
  color: var(--rojoTitulo);
}

#opciones{
  width: calc(100 * var(--midaLetra) / 6) !important;
  font-size:calc(5 * var(--midaLetra) / 6);
  border:0;
}
#opciones button{
  margin-left:1em;
}
/*ADVERTISEMENT*/
#ad{
  background-color: #f96854;
  color:white;
  font-size:1em;
  border-radius: 1em;
}
#ad a{
  color:#62ce7e;

}
/*RESULTADO*/
#mainContainer{
  margin-top:calc(5 * var(--midaLetra) / 9);
}
.swiper-container {
  width: 100%;
  height: 100%;
}
.swiper-wrapper{
  overflow: visible;	
}
.swiper-slide{
  overflow: visible;	
}
.swiper-pagination-bullet
{
  background-color:#8b1c1b;
}
.swiper-button-prev{
  position: fixed !important;
  color:#8b1c1b !important;
  background:none;
  top:50%;
}
.swiper-button-next{
  position: fixed !important;
  color:#8b1c1b !important;
  background:none;
  top:50%;
}
/*PARTE FEATURE*/
article.result {
  background-color:white;
  padding-top:15px;
  padding-right:15px;
  overflow: visible;
}
article.result strong{
  /*margin-right:0.2em;*/
  font-family: 'GoodOT_Bold';
}
/*PARTE CABECERA FEATURE*/
article.result  header{
  margin-bottom:0em;
  position:relative;
}
article.result  header > h1, article.result  header > h2{
  font-family: 'GoodOT_CondBold';
  font-size: calc(10 * var(--midaLetra) / 9);
  margin-bottom:0;
  padding-bottom:calc(1 * var(--midaLetra) / 18);
}
article.result header > h2{
  text-align: right;
}

/*PARTE FILA DE RASGOS*/
article.result section.traits, article.result section.traitsExtra{
  border-top:1.5px solid black;
  position:relative;
  padding-top:calc(1 * var(--midaLetra) / 18);
  margin-top:calc(-5 * var(--midaLetra) / 18) !important;
}
article.result section.traits > div, article.result section.traitsExtra > div{
  background-color: var(--backTraits);
}
article.result section.traits > div > h3, article.result section.traitsExtra > div > h3{
  font-family: 'GoodOT_CondBold';
  font-size: calc(1 * var(--midaLetra) / 2);
  background-color: var(--rojoNormal);
  color:white;
  margin:0.1em 0.15em 0.1em 0.15em;
  padding:0.2em 0.5em;
  cursor:help;
}
article.result section.traits > div > h3.rarity, article.result section.traitsExtra > div > h3.rarity{
  background-color: var(--rarity);
}
article.result section.traits > div > h3.rarity.rare, article.result section.traitsExtra > div > h3.rarity.rare{
  background-color: var(--rare);
}
article.result section.traits > div > h3.settlement, article.result section.traitsExtra > div > h3.settlement{
  background-color: var(--settlement);
}
article.result section.traits > div > h3.rarity.unique, article.result section.traitsExtra > div > h3.rarity.unique{
  background-color: var(--unique);
}
article.result section.traits > div > h3.alignment, article.result section.traitsExtra > div > h3.alignment{
  background-color: var(--alignment);
}
article.result section.traits > div > h3.size, article.result section.traitsExtra > div > h3.size{
  background-color: var(--size);
}
/*PARTE DE PRERREQUISITOS, ETC.*/
section.details{
  border-bottom:1.5px solid black;
  position:relative;
}
section.details.addon{
  border-bottom:none;
  border-top:1.5px solid black;
  position:relative;
  padding-top:1em;
  margin-top:1em;
}
section.details.addon *{
  font-size: calc(4 * var(--midaLetra) / 7);
}
section.details > p{
  font-family: 'GoodOT';
  font-size: calc(2 * var(--midaLetra) / 3);
  text-indent: -1em;
  margin-left: 1em;
  margin-bottom:0;
  text-align: justify;
}
/*PARTE DESCRIPCION*/

section.content > h2{
  font-family: 'GoodOT_CondBold';
  font-variant: small-caps;
  font-size: calc(10 * var(--midaLetra) / 9);
  color:var(--encabezado2);
}
section.content > h2 > em{
  font-family: 'GoodOT_CondBold' !important;
  font-style:normal !important;
}
`

class lookup {
    constructor (client) {
        let lookupCommandRegex = /^! ?lookup/i;
        client.on('message', message => {
            if (lookupCommandRegex.test(message.content)) {
                lookupTerm(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (lookupCommandRegex.test(newMessage)) {
                lookupTerm(newMessage);
            }   
        });
        console.log('Successfully loaded lookup plugin.');
    }
}
function lookupTerm(message) {
    var ID=0;
    var searchResults = [];
    
    const findSearchTerm = /! ?lookup ([\w ]+)\(?(\d+)?\)?/i;
    var foo = message.content.match(findSearchTerm);
    console.log(foo);
    var searchTerm = foo[1];
    if (foo.length > 1)
        var disambiguousSelector = foo[2];

    var disambiguousMessageText = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
    var disambiguousMessageCount = 0;
    const findID = /value='(\d+)'/i;
    const findResult = new RegExp("<strong>(" + searchTerm + ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'","mis");
    const findResultExtended = new RegExp("<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'","mis");

    curl.request({url: 'https://pf2.easytool.es/php/search.php', method:'POST', data:'name='+searchTerm}, async function (err,response) {
    
        responses = response.split('<button'); 
        for (foo of responses) {
            result = findResult.exec(foo);
            if (result) {
                searchResults.push(result);
                disambiguousMessageCount++;
                disambiguousMessageText = disambiguousMessageText + "(" + disambiguousMessageCount + ") " + result[1] + ' - ' + result[2] + "\n";
            }
        }
        console.log(searchResults);
        if (!searchResults || searchResults.length == 0) {
            for (foo of responses) {
                result = findResultExtended.exec(foo);
                if (result) {
                    searchResults.push(result);
                    disambiguousMessageCount++;
                    disambiguousMessageText = disambiguousMessageText + "(" + disambiguousMessageCount + ") " + result[1] + ' - ' + result[2] + "\n";
                }
                if (disambiguousMessageCount >= 30) {
                  //If it gets too long, Discord will be unhappy, so break before that happens.
                  break;
                }
            }
        }   
        if (!searchResults || searchResults.length == 0) {
            message.channel.send("Sorry, couldn't find anything when searching for "+searchTerm);
            return;
        }
        
        if (searchResults.length == 1) {
            ID = searchResults[0][3];
            getImageAndSend(message,ID);
        } else if (disambiguousSelector) {
            ID = searchResults[disambiguousSelector-1][3];
            getImageAndSend(message,ID);
        }else {
            message.reply(disambiguousMessageText)
                .then(disambiguousMessageMessage => {
                    const filter = msg => /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
            
                    message.channel.awaitMessages(filter, {max: 1, time: 30000, errors: ['time'] })
                    .then(msg => {
                        msg = msg.first();
                        disambiguousMessageMessage.delete().catch(console.error);
                        ID = searchResults[parseInt(msg.content)-1][3];
                        getImageAndSend(message,ID);
                        msg.delete().catch(console.error);
                    })
                    .catch(err => {
                        console.log(err);
                        disambiguousMessageMessage.delete().catch(console.error);
                        message.reply('Lookup cancelled.');
                    });
                })
            
        }
    }); 
}

async function getImageAndSend(message, ID) {
    if (ID < 1)
        throw `Invalid ID given. I can't lookup ${ID}`;
    
    console.log("Getting screenshot...");
    
    let tmpdir = tmp.dirSync(),
        url = 'https://pf2.easytool.es/index.php?id='+ID,
        dest = tmpdir.name,
        filename = 'foo.png'
        finalOptions = {
            delay:2,
            timeout: 60,
            styles: ['https://pf2.easytool.es/css/light.css',`section.content > p, section.content li{
                font-family: 'SabonLTSstd';
                /*font-family: 'GoodOT';*/
                /*font-size: x-large;*/
                text-align:left;
              }`],
            styles: [css],
            removeElements: ['footer','#diceRoller'],
            fullPage: false,
            element: 'article.result',
            type: 'png',
            launchOptions: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        };
    
    const screenshot = await captureWebsite.buffer(url, finalOptions);
    
    await makeDir(dest);
    
    const fullPath = path.join(dest, filename);
    
    await writeFile(fullPath, screenshot);
    
    console.log('Saving to ' + dest);
    message.channel.send({files: [{attachment: tmpdir.name+'/' + filename,name:'results.png'}]})
    .then(msg => {
        tmp.setGracefulCleanup();
    })
    .catch(error => {
        console.error(error);
        tmp.setGracefulCleanup();
    });
}

module.exports = (client) => { return new lookup(client) }
