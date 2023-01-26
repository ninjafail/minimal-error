import * as http from "node:http";
import * as fs from "node:fs";
import * as childProcess from "node:child_process";

export class FCInstanceControl {
  fcBinaryPath: string;
  fcSocketPath: string;
  instance!: childProcess.ChildProcessWithoutNullStreams;

  private inputBuffer = "";

  constructor(
    fcBinaryPath: string,
    fcSocketPath: string = "/tmp/firecracker.socket"
  ) {
    this.fcBinaryPath = fcBinaryPath;
    this.fcSocketPath = fcSocketPath;

    this.init();
  }

  private init() {
    // delete socket file if it exists
    if (fs.existsSync(this.fcSocketPath)) fs.unlinkSync(this.fcSocketPath);
    console.log(fs.existsSync(this.fcSocketPath));

    // spawn new fc instance
    this.instance = childProcess.spawn(this.fcBinaryPath, [
      "--api-sock",
      this.fcSocketPath,
    ]);

    // since chunks can be a small size, always save the last line, ended by `\n`
    // needed for the login
    this.instance.stdout.on("data", (data) => {
      process.stdout.write(data);
      this.inputBuffer += data;

      // check for when its started
      if (this.inputBuffer.includes("Last login: ")) {
        this.instance.emit("message", "started");
      }

      if (this.inputBuffer.includes("root@ubuntu:")) {
        this.instance.emit("message", "executed");
      }

      if (this.inputBuffer.includes("finished")) {
        this.instance.emit("message", "initexec");
      }

      // reset input buffer after `\n`
      if (this.inputBuffer.indexOf("\n") !== -1) {
        this.inputBuffer = this.inputBuffer.substring(
          this.inputBuffer.indexOf("\n") + 1
        );
      }
    });

    this.instance.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    this.instance.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
    });
  }

  waitForInitExec() {
    return new Promise<void>((resolve) => {
      this.instance.once('message', (message) => {
        if (message == 'initexec') {
          resolve();
        }
        console.log(message)
      })
    })  
  }

  executeStdIn(cmd: string, timeout = 30000) {
    return new Promise<void>(async (resolve, reject) => {
      if (timeout !== 0)
        setTimeout(
          () => reject(`timed out on command: ${cmd} after ${timeout}ms`),
          timeout
        );
      this.instance.once("message", (message) => {
        if (message == "executed") {
          resolve();
        }
        console.log(message)
      });
      this.instance.stdin.write(`${cmd} \n`);
    });
  }

  killInstance() {
    this.instance.kill("SIGINT");
  }

  async loadSnapshot(snapshotFilePath: string) {
    await this._loadSnapshot(`snapshots/${snapshotFilePath}`, `snapshots/${snapshotFilePath}_mem`);
    await this.resumeInstance();
  }

  async createSnapshot(snapshotFilePath: string) {
    await this.pauseInstance();
    await this._createSnapshot(
      snapshotFilePath,
      `${snapshotFilePath}_mem`,
      "Full"
    );
    await this.resumeInstance();
  }

  private _loadSnapshot(snapshotFilePath: string, memFilePath: string) {
    return this.makeFCRequest("/snapshot/load", "PUT", {
      snapshot_path: snapshotFilePath,
      mem_backend: {
        backend_path: memFilePath,
        backend_type: "File",
      },
      enable_diff_snapshots: false,
      resume_vm: false,
    });
  }

  private _createSnapshot(
    snapshotFilePath: string,
    memFilePath: string,
    snapshotType: "Full" | "Diff"
  ) {
    return this.makeFCRequest("/snapshot/create", "PUT", {
      snapshot_type: snapshotType,
      snapshot_path: snapshotFilePath,
      mem_file_path: memFilePath,
      version: "1.2.0",
    });
  }

  async shutdown(timeout = 90000) {
    const promise = new Promise<void>(async (resolve, reject) => {
      setTimeout(
        () => reject(`timed out on shutdown after ${timeout}ms`),
        timeout
      );
      this.instance.addListener("close", () => {
        resolve();
      });
      this.instance.stdin.write(`reboot \n`);
    });
    return promise;
  }

  private pauseInstance() {
    return this.makeFCRequest("/vm", "PATCH", { state: "Paused" });
  }

  private resumeInstance() {
    return this.makeFCRequest("/vm", "PATCH", { state: "Resumed" });
  }

  private async makeFCRequest(path: string, method: string, options: any) {
    const res: http.IncomingMessage = await this._makeFCRequest(
      path,
      method,
      options
    );
    console.log(`${method}${path}: ${JSON.stringify(options)}`);
    console.log(
      `${res.method}/${res.httpVersion} ${res.statusCode} ${res.statusMessage}`
    );
    console.log(res.headers);
    console.log(`${res.read()}`);
    console.log();
    return res;
  }

  private _makeFCRequest(path: string, method: string, options: any) {
    return new Promise<http.IncomingMessage>((resolve) => {
      const body = JSON.stringify(options);
      let ret!: http.IncomingMessage;
      const req = http.request(
        {
          socketPath: this.fcSocketPath,
          method: method,
          path: path,
        },
        (res) => {
          resolve(res);
        }
      );
      req.setHeader("Accept", "application/json");
      req.setHeader("Connection", "close");
      req.setHeader("Content-Type", "application/json");
      req.setHeader("Content-Length", Buffer.byteLength(body));
      req.write(body);
      req.on("close", () => console.log("closed"));
      req.end();
    });
  }
}
