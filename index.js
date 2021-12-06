const puppeteer = require("puppeteer");
const fs = require("fs");

fs.open("urls", "a+", () => {});
fs.open("result", "a+", () => {});

let urls = [];
let payloads = [];
let shouldBreak = false;

try {
  urls = fs.readFileSync("urls").toString().split("\n");
} catch (error) {
  console.log("Couldn't open URLs file");
  process.exit();
}

try {
  payloads = fs.readFileSync("payloads").toString().split("\n");
} catch (error) {
  console.log("[Error] Couldn't open payloads file");
  process.exit();
}

const urlsLen = urls.length;
const payloadsLen = payloads.length;

// console.log(urls);
if (urlsLen === 0 || (urlsLen === 1 && urls[0] === "")) {
  console.log("[Error] URLs file is empty");
  process.exit();
}

// console.log(payloads);
if (payloadsLen === 0 || (payloadsLen === 1 && payloads[0] === "")) {
  console.log("[Error] Payloads file is empty");
  process.exit();
}

console.log("[Info] Number of payloads: ", payloadsLen);
console.log("[Info] Number of URLs: ", urlsLen);

async function startBrowser() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--disable-setuid-sandbox"],
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    console.log("Error starting the browser: ", err);
  }
  return browser;
}

const pageScraper = async (browser, url, payload) => {
  let page = await browser.newPage();

  await page.goto(url);

  browser.on("targetcreated", async (target) => {
    const page = await target.page();
    if (page) page.close();
  });

  const pageFrame = page.mainFrame();
  const elems = await pageFrame.$$("*");
  // console.log(await elems[100].type());

  page.on("dialog", async (dialog) => {
    if (dialog._message === "1") {
      console.log("[Success] Found one! [url] ", url, "[Payload]", payload);
      fs.appendFile("result", url + " " + payload + "\n", function (err) {
        if (err) throw err;
      });
      shouldBreak = true;
      await browser.close();
    } else {
      await dialog.dismiss();
    }
  });

  let elemsLen = elems.length;
  const buttons = [];
  const inputs = [];

  for (let i = 0; i < elemsLen; i++) {
    try {
      const tagName = (
        await (await elems[i].getProperty("tagName")).jsonValue()
      ).toLowerCase();
      if (tagName === "button") {
        buttons.push(elems[i]);
        continue;
      }
      if (
        tagName === "textarea" ||
        tagName === "input" ||
        tagName === "remote-input"
      ) {
        inputs.push(elems[i]);
        continue;
      }
    } catch (_) {}
  }
  const inputsLen = inputs.length;
  const buttonsLen = buttons.length;

    console.log("inputsLen", inputsLen);
  //   console.log("buttonsLen", buttonsLen);

  if (inputsLen === 0) {
    shouldBreak = true;
    await browser.close();
  }
  for (let j = 0; j < buttonsLen; j++) {
    for (let k = 0; k < inputsLen; k++) {
      try {
        // console.log("Input number: ", k);
        await inputs[k].click();
        await inputs[k].type(payload);
      } catch (_) {}
    }
    try {
      //   console.log("Button number: ", j);
      await buttons[j].click();
      // await page.evaluate(() => location.reload(true));
    } catch (_) {}
  }

  // await page.waitForTimeout(5000);
  try {
    await browser.close();
  } catch (_) {}
};

async function scrapeAll() {
  try {
    for (let i = 0; i < urlsLen; i++) {
      const url = urls[i];
      if (url === "") continue;
      console.log(`[Info] Page URL: ${url}`);
      console.log("[Info] Hunting XSS...");
      for (let j = 0; j < payloadsLen; j++) {
        const payload = payloads[j];
        try {
          if (payload === "") continue;
          await pageScraper(await startBrowser(), url, payload);
        } catch (_) {
          console.log("[Error] ", _);
        }
        if (shouldBreak) {
          shouldBreak = false;
          break;
        }
      }
    }
  } catch (err) {
    console.log("[Error] ", err);
  }
}

scrapeAll();
