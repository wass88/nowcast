const puppeteer = require('puppeteer');

// copy(JSON.stringfy(localStorage))
const config={"jmamap.AMD_RAIN10M":"true","jmamap.HRKSNC":"true","jmamap.HRKSNC_GRAY":"false","jmamap.HRKSNC_NONE":"false","jmamap.KMNC":"false","jmamap.LIDEN":"true","jmamap.MOVE":"true","jmamap.MOVE_SEVERE":"false","jmamap.MOVE_SLIGHTLY_HEAVY":"false","jmamap.MUNICIPALITY":"true","jmamap.RAILROAD":"false","jmamap.RIVER":"false","jmamap.ROAD":"false","jmamap.TPNC":"false","jmamap.TPNC1_KMNC2":"true","jmamap.TPNC2_KMNC4":"false","jmamap.animationSpeed":"3","jmamap.centerLat":"35.011841","jmamap.centerLon":"135.726318","jmamap.circle":"false","jmamap.control":"true","jmamap.geolocation":"false","jmamap.height":"500","jmamap.highresorad.howtoOpen":"1530248695912","jmamap.highresorad.switchtype.MOVE_RAIN":"\"MOVE\"","jmamap.highresorad.switchtype.TPNC_KMNC":"\"TPNC1_KMNC2\"","jmamap.kaikotan.howtoOpen":"1532598230532","jmamap.legend":"true","jmamap.width":"680","jmamap.zoom":"7"};
console.log(config);

(async () => {
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

  await browser.close();
})();