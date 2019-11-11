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

  const image = await page.$(imageSelector);
  await image.screenshot({path: './image/now.png'});
  const nextTimeSelector = ".jmamesh-contents > tr:nth-child(4) > td > table > tr > td:nth-child(5) > input";
  const nextTime = await page.$(nextTimeSelector);
  for (let i = 0; i < 10; i++){
    await nextTime.click();
    await page.waitFor(50);
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
const revtable_ = Object.keys(colortable)
  .map(k=>[colortable[k], Number(k)])
revtable_.sort((x,y)=>x[0]-y[0]);
function revtable(x){
  for (let k of revtable_) {
      if (x <= k[0]) {
        const {r, g, b, a} = Jimp.intToRGBA(k[1]);
        return [r, g, b, a];
      }
  }
}
async function rainCell(imagef) {
    const image = await Jimp.read(imagef);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const target = 50;
    const skip = 10;
    const targetx = 364;
    const targety = 280;
    const xl = targetx - target / 2;
    const yl = targety - target / 2;
    const rains = []
    for (let dx = 0; dx < target; dx+=skip){
        for (let dy = 0; dy < target; dy+=skip){
            const color = image.getPixelColor(xl+dx,yl+dy);
            rains.push(colortable[color] || 0);
        }
    }
    return rains;
}
function infoCell(c) {
    const r = c.filter(x=>x>0);
    return {
        "max": Math.max(...c),
        "ave": (r.length == 0) ? 0 : r.reduce((a,b)=>a+b, 0) / r.length,
        "rain": r.length / c.length
    }
}
async function makeRainTable(){
    await saveImage();
    const table = []
    for (let i = 1; i < 10; i++){
        table.push({time:i*5, ... infoCell(await rainCell(`image/predict${i}.png`))});
    }
    for (let i = 0; i < 10; i++){
        table.push({time:i*60+60, ... infoCell(await rainCell(`image/longpredict${i}.png`))});
    }
    return table
}

var fs = require('fs');
var drawing = require('pngjs-draw');
var PNG = require('pngjs').PNG;
var png = drawing(require('pngjs').PNG);
var moment = require("moment");

function renewImage(table) {
    const CWIDTH = 40;
    const CHEIGHT = 20;
    const MARGIN = 5;
    const BMARGIN = 10;
    const SPAN = 7;
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
            let h = (1-Math.pow((1-t["rain"]), 3)) * CHEIGHT;
            this.fillRect(cur, ~~(MARGIN + (CHEIGHT - h)/2),
              cnow-cur, h, revtable(t["max"]));
            cur = cnow;
        }
        this.pack().pipe(fs.createWriteStream('graph.png'));
        console.log("OUTPUTED to graph.png");
    });
}
const sampletable = [ { time: 5, max: 10, ave: 0, rain: 0.4 },
  { time: 10, max: 40, ave: 5, rain: 0.1 },
  { time: 15, max: 3, ave: 0, rain: 0.2 },
  { time: 20, max: 1, ave: 10, rain: 0.9 },
  { time: 25, max: 0, ave: 0, rain: 0 },
  { time: 30, max: 0, ave: 0, rain: 0 },
  { time: 35, max: 0, ave: 0, rain: 0 },
  { time: 40, max: 0, ave: 0, rain: 0 },
  { time: 45, max: 0, ave: 0, rain: 0.1 },
  { time: 60, max: 0, ave: 0, rain: 0.1 },
  { time: 120, max: 0, ave: 0, rain: 0.1 },
  { time: 180, max: 0, ave: 0, rain: 0.1 },
  { time: 240, max: 0, ave: 0, rain: 0.1 },
  { time: 300, max: 0, ave: 10, rain: 0.8 },
  { time: 360, max: 0, ave: 0, rain: 0.1 },
  { time: 420, max: 0, ave: 0, rain: 0.1 },
  { time: 480, max: 0, ave: 0, rain: 0.1 },
  { time: 540, max: 0, ave: 0, rain: 0 },
  { time: 600, max: 0, ave: 0, rain: 0 } ];
//
//const twitter = require('twitter');
//const client = new twitter({
//    consumer_key: config.twitter.consumerKey,
//    consumer_secret: config.twitter.consumerSecret,
//    access_token_key: config.twitter.accessTokenKey,
//    access_token_secret: config.twitter.accessTokenSecret
//});
//
async function sendImg(text) {
    const data = fs.readFileSync('graph.png'); //投稿する画像
    const media = await client.post('media/upload', {media: data});
    console.log(media);

    //Twitterに投稿
    const status = {
        status: text,
        media_ids: media.media_id_string // Pass the media id string
    }
    const response = await client.post('statuses/update', status);
    console.log(response);
}

(async () => {
const table = await makeRainTable();
//const table = sampletable;
console.log(table);
renewImage(table);
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