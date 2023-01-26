import * as puppeteer from "puppeteer";

export async function executePuppeteerInsideVM() {
  const executeInsideVM: ExecuteInsideVM = new ExecuteInsideVM();
  await executeInsideVM.init();
  return executeInsideVM;
}

export class ExecuteInsideVM {
  browser!: puppeteer.Browser;
  currentPage!: puppeteer.Page;

  constructor() {}

  async init() {
    this.browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    this.currentPage = await this.browser.newPage();
    await this.currentPage.goto("https://firecracker-microvm.github.io/");
    await this.currentPage.waitForSelector("a");
  }

  async executePuppeteer() {
    const elem = await this.currentPage.$('a')
    console.log(elem)
    await elem?.click()
    await this.currentPage.waitForSelector("a");    
  }
}
