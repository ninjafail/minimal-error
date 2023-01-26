import { executePuppeteerInsideVM } from "./executeInsideVM"
import { setTimeout } from "timers/promises";

(async () => { 
  const executor = await executePuppeteerInsideVM()
  console.log('finished')

  for (let i = 0; i<10; i++) {
    await setTimeout(1000)
    await executor.executePuppeteer()
    console.log('finished')
  }
})()