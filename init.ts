import { executePuppeteerInsideVM } from "./executeInsideVM"
import { setTimeout } from "timers/promises";

(async () => { 
  const executor = await executePuppeteerInsideVM()
  console.log('finished')

  while (1) {
    await setTimeout(1000)
    await executor.executePuppeteer()
    console.log('finished')
  }
})()