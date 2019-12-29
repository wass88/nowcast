const puppeteer = require('puppeteer');
var Jimp = require('jimp');

// copy(JSON.stringfy(localStorage))
const config={"jmamap.AMD_RAIN10M":"true","jmamap.HRKSNC":"true","jmamap.HRKSNC_GRAY":"false","jmamap.HRKSNC_NONE":"false","jmamap.KMNC":"false","jmamap.LIDEN":"true","jmamap.MOVE":"true","jmamap.MOVE_SEVERE":"false","jmamap.MOVE_SLIGHTLY_HEAVY":"false","jmamap.MUNICIPALITY":"true","jmamap.RAILROAD":"false","jmamap.RIVER":"false","jmamap.ROAD":"false","jmamap.TPNC":"false","jmamap.TPNC1_KMNC2":"true","jmamap.TPNC2_KMNC4":"false","jmamap.animationSpeed":"3","jmamap.centerLat":"35.011841","jmamap.centerLon":"135.726318","jmamap.circle":"false","jmamap.control":"true","jmamap.geolocation":"false","jmamap.height":"500","jmamap.highresorad.howtoOpen":"1530248695912","jmamap.highresorad.switchtype.MOVE_RAIN":"\"MOVE\"","jmamap.highresorad.switchtype.TPNC_KMNC":"\"TPNC1_KMNC2\"","jmamap.kaikotan.howtoOpen":"1532598230532","jmamap.legend":"true","jmamap.width":"680","jmamap.zoom":"7"};

async function saveImage(){
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.jma.go.jp/jp/highresorad/');
  await page.evaluate((config) => {
      for (const k of Object.keys(config)){
          localStorage.setItem(k, config[k])
      }
  }, config);
  const imageSelector = ".jmamesh-contents > tr:nth-child(5)";
  await page.waitForSelector(imageSelector);

  await page.waitFor(5000);
  const image = await page.$(imageSelector);
  await image.screenshot({path: './image/now.png'});
  const nextTimeSelector = ".jmamesh-contents > tr:nth-child(4) > td > table > tr > td:nth-child(5) > input";
  const nextTime = await page.$(nextTimeSelector);
  for (let i = 0; i < 10; i++){
    await nextTime.click();
    await page.waitFor(200);
    await image.screenshot({path: `./image/predict${i}.png`});
  }
  //await page.screenshot({path: 'example.png'});
  

  {
  const longpredictSeletor = "#jmameshcntl-kaikotan > label";
  const longpredict = await page.$(longpredictSeletor);
  await longpredict.click();
  
  const imageSelector = ".jmamesh-contents > tr:nth-child(4)";
  await page.waitForSelector(imageSelector);
  await page.waitFor(100);

  const image = await page.$(imageSelector);
  const nextTimeSelector = ".jmamesh-contents > tr:nth-child(3) > td > table > tr > td:nth-child(5) > input";
  const nextTime = await page.$(nextTimeSelector);
  for (let i = 0; i < 10; i++){
    await image.screenshot({path: `./image/longpredict${i}.png`});
    await nextTime.click();
    await page.waitFor(50);
  }
  }
  await browser.close();
}
const colortable = {
0x99b68cff: 0,
0xffffffff: 0,
0xf2f2ffff: 1,
0xa0d2ffff: 5,
0x1b8cffff: 10,
0x0035ffff: 20,
0xfff500ff: 30,
0xff9900ff: 50,
0xff2000ff: 80,
0xb40068ff: 130,
};

const colormemo = {};
function fetchRainColor(c) {
  if (colormemo[c]) {
    return colormemo[c];
  }
  const x = numToRGBA(c);
  let res = 0;
  let min = 0xffffffff;
  for (const [k,v] of Object.entries(colortable)){
    const y = numToRGBA(Number.parseInt(k));
    const dist = (x[1] - y[1]) * (x[1] - y[1]) +
      (x[2] - y[2]) * (x[2] - y[2]) +
      (x[3] - y[3]) * (x[3] - y[3]);
    if (dist < min) {
      res = v;
      min = dist;
    }
  }
  colormemo[c] = res;
  return res;
}

const target = 25; // height of slit
async function seekCell(imagef) {
    const image = await Jimp.read(imagef);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const targetx = 365;
    const targety = 275;
    const yl = targety - target / 2;
    const rains = []
    const colors = []
    let rained = 0;
    for (let dy = 0; dy < target; dy+=1){
        const color = image.getPixelColor(targetx,yl+dy);
        colors.push(color);
        const rain = fetchRainColor(color);
        rains.push(rain);
        if (rain != 0) {
          rained++;
        }
    }
    return {rains, colors, rained};
}
async function makeRainTable(){
    const table = []
    for (let i = 1; i < 10; i++){
        const img = `image/predict${i}.png`;
        table.push({time:i*5, image:img, ... await seekCell(img)});
    }
    for (let i = 0; i < 10; i++){
        const img = `image/longpredict${i}.png`;
        table.push({time:i*60+60, image:img, ... await seekCell(img)});
    }
    return table
}

function numToRGBA(num) {
  const t = Jimp.intToRGBA(num);
  return [t.r,t.g,t.b,t.a];
}
var fs = require('fs');
var drawing = require('pngjs-draw');
var PNG = require('pngjs').PNG;
var png = drawing(require('pngjs').PNG);
var moment = require("moment");

function renewImage(table) {
    const CWIDTH = 40;
    const CHEIGHT = target;
    const MARGIN = 5;
    const BMARGIN = 10;
    const SPAN = 10;
    const TIME = 60;
    const IWIDTH = CWIDTH * SPAN;

    var img = new PNG({
        width: IWIDTH + MARGIN*2,
        height: CHEIGHT + BMARGIN + MARGIN*2,
        filterType: -1
    });
    img.data.fill(255);
    img.pack()
    .pipe(new png({ filterType: 4 }))
    .on('parsed', function() {
        const back = this.colors.new(60,60,60);
        this.fillRect(0, 0, img.width, img.height, back);

        const gray = this.colors.new(200,200,200);
        //this.drawLine(MARGIN, MARGIN + CHEIGHT, MARGIN + IWIDTH, MARGIN + CHEIGHT, gray);
        //this.drawLine(MARGIN, MARGIN + CHEIGHT, MARGIN, MARGIN, gray);

        const nowt = moment().add( -moment().minute() % 5, "minutes");
        for (let i = 0; i < SPAN+1; i++){
            const s = nowt.add(TIME, "minutes").format("HHmm");
            this.drawText(MARGIN+Math.min(CWIDTH*SPAN-23, Math.max(0, CWIDTH*i-10)), 
              MARGIN+CHEIGHT+4, s, gray);
            this.drawLine(MARGIN+CWIDTH*i, MARGIN+CHEIGHT-1, MARGIN+CWIDTH*i, MARGIN+CHEIGHT+2, gray);
        }

        let px = t=>~~(t/TIME*CWIDTH+MARGIN);
        let cur = px(0);
        for (let t of table) {
            if (t["time"] > TIME*SPAN) break;
            const cnow = px(t["time"]);
            t["colors"].forEach((color, y) => {
              this.fillRect(cur, MARGIN + y, cnow-cur, 1, numToRGBA(color));
            })
            cur = cnow;
        }
        this.pack().pipe(fs.createWriteStream('graph.png'));
        console.log("OUTPUTED to graph.png");
    });
}

const secret = require("./secret.json");
const cloudinary = require("cloudinary").v2;
cloudinary.config(secret["cloudinary"]);

const request = require('request');


function postSlack(msg){
    const options = {
        url: secret["incoming"],
        form: `payload={"text": "${msg}", "username": "nowcast","icon_emoji": ":umbrella:", "channel": "#nowcast"}`,
        json :true
    };
    return new Promise((ok, ng) => {
      request.post(options, function(error, response, body){
        if (!error && response.statusCode == 200) {
          ok(body.name);
        } else {
          ng(error, body)
        }
      });
    })
}

function uploadImage(filename){
  return new Promise((ok, ng) => {
    cloudinary.uploader.upload(filename, { folder: 'test'  },
    (error, result) => {
      if (error) {
        ng(error)
      } else {
        ok(result)
      }
    });
  })
}


function searchRainedSunny(table){
  let rain = null;
  let sunny = null
  let lim = target/3;
  for (const t of table) {
    if (!rain && t["rained"] >= lim) {
      rain = t;
    }
    // 33% rained is sunny
    if (rain && t["rained"] < lim) {
      sunny = t;
    }
  }
  return {rain, sunny};
}

const util = require('util');

(async () => {
  await saveImage();
  const table = await makeRainTable();
  console.log(util.inspect(table, {"depth": null}));
  renewImage(table);
  const {rain, sunny} = searchRainedSunny(table);
  if (rain) {
    let res = await uploadImage(rain["image"]);
    await postSlack("雨が降りそう!\n"+res["url"])
    if (sunny) {
      res = await uploadImage(sunny["image"]);
      await postSlack("この時間に止む?\n"+res["url"])
    } else {
      await postSlack("しばらく止まなそう…");
    }
    res = await uploadImage(`graph.png`);
    await postSlack("京都大学周辺予報\n"+res["url"]);
  }
})()
//require('date-utils');
//setInterval(
//    () => {
//        const table = await makeRainTable();
//        console.log(table);
//        renewImage(table);
//        sendImg("");
//    }, 1000 * 60 * 30
//);