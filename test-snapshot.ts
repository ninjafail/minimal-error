import { FCInstanceControl } from "./fcInstanceControl";
import { setTimeout } from "timers/promises";
const prompt = require("prompt-sync")({ sigint: true });

const FIRECRACKER_BINARY_PATH =
  "/home/florian/programs/firecracker_binary/release-v1.2.0-x86_64/firecracker";
const START_SNAPSHOT_PATH = "./start_snapshot";

(async () => {
  let fcInstance = new FCInstanceControl(FIRECRACKER_BINARY_PATH);
  fcInstance.loadSnapshot(START_SNAPSHOT_PATH);
  fcInstance.instance.stdin.write('npm run init \n')

  for (let i = 0; i < 10; i++) {
    let snapshotName = `snapshot${i}`;
    await fcInstance.waitForInitExec()
    await fcInstance.createSnapshot(snapshotName);
    await fcInstance.shutdown();
    fcInstance.killInstance();
    await setTimeout(1000);
    fcInstance = new FCInstanceControl(FIRECRACKER_BINARY_PATH);
    await fcInstance.loadSnapshot(snapshotName);
    await setTimeout(1000);
  }
})();
