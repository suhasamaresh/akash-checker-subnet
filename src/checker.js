// ~/akash-checker/src/checker.js
const axios = require("axios");
const ping = require("ping");
const geoip = require("geoip-lite");
const { Client } = require("ssh2");
const fs = require("fs").promises;

class AkashNodeChecker {
  constructor(nodes) {
    this.nodes = nodes; // [{id, host_uri, ssh_ip, ssh_port}, ...]
    this.results = nodes.reduce(
      (acc, node) => ({
        ...acc,
        [node.id]: {
          retrievability: [],
          latency: [],
          availability: [],
          bandwidth: [],
          uptime: 0,
          geolocation: null,
          computeAccuracy: [],
        },
      }),
      {}
    );
    this.uptimeChecks = nodes.reduce(
      (acc, node) => ({ ...acc, [node.id]: 0 }),
      {}
    );
    this.totalChecks = 0;
    this.testCommand = 'echo "Hello, Akash Checker" > test.txt && cat test.txt';
  }

  async testRetrievability(node) {
    if (!node.ssh_ip) {
      console.log(`Skipping retrievability test for ${node.id}: No SSH IP available`);
      this.results[node.id].retrievability.push(0);
      this.results[node.id].latency.push(Infinity);
      return false;
    }
    return new Promise((resolve) => {
      const conn = new Client();
      const startTime = Date.now();
      conn
        .on("ready", () => {
          conn.exec(this.testCommand, (err, stream) => {
            if (err) {
              this.results[node.id].retrievability.push(0);
              this.results[node.id].latency.push(Infinity);
              conn.end();
              return resolve(false);
            }
            let output = "";
            stream
              .on("data", (data) => (output += data))
              .on("close", () => {
                const latency = Date.now() - startTime;
                const success = output.includes("Hello, Akash Checker");
                this.results[node.id].retrievability.push(success ? 1 : 0);
                this.results[node.id].latency.push(success ? latency : Infinity);
                conn.end();
                resolve(success);
              });
          });
        })
        .on("error", (err) => {
          console.error(`Retrievability error for ${node.id}: ${err.message}`);
          this.results[node.id].retrievability.push(0);
          this.results[node.id].latency.push(Infinity);
          conn.end();
          resolve(false);
        })
        .connect({
          host: node.ssh_ip,
          port: node.ssh_port || 22,
          username: 'root',
          password: 'password',
          readyTimeout: 10000,
        });
    });
  }

  async testBandwidth(node) {
    if (!node.ssh_ip) {
      console.log(`Skipping bandwidth test for ${node.id}: No SSH IP available`);
      this.results[node.id].bandwidth.push(0);
      return 0;
    }
    return new Promise((resolve) => {
      const conn = new Client();
      const startTime = Date.now();
      conn
        .on("ready", () => {
          conn.sftp((err, sftp) => {
            if (err) {
              this.results[node.id].bandwidth.push(0);
              conn.end();
              return resolve(0);
            }
            const testFileSizeMb = 10;
            const testFile = Buffer.alloc(testFileSizeMb * 1024 * 1024, "x");
            sftp.writeFile("/tmp/testfile.bin", testFile, (writeErr) => {
              if (writeErr) {
                this.results[node.id].bandwidth.push(0);
                conn.end();
                return resolve(0);
              }
              sftp.readFile("/tmp/testfile.bin", (readErr, data) => {
                if (readErr) {
                  this.results[node.id].bandwidth.push(0);
                } else {
                  const elapsed = (Date.now() - startTime) / 1000;
                  const bandwidth = testFileSizeMb / elapsed;
                  this.results[node.id].bandwidth.push(bandwidth);
                  resolve(bandwidth);
                }
                conn.end();
              });
            });
          });
        })
        .on("error", (err) => {
          console.error(`Bandwidth error for ${node.id}: ${err.message}`);
          this.results[node.id].bandwidth.push(0);
          conn.end();
          resolve(0);
        })
        .connect({
          host: node.ssh_ip,
          port: node.ssh_port || 22,
          username: 'root',
          password: 'password',
          readyTimeout: 10000,
        });
    });
  }

  async checkAvailability(node) {
    try {
      const res = await ping.promise.probe(
        node.host_uri.split("//")[1].split(":")[0],
        { timeout: 5 }
      );
      const available = res.alive;
      this.results[node.id].availability.push(available ? 1 : 0);
      return available;
    } catch (error) {
      console.error(`Availability check failed for ${node.id}: ${error.message}`);
      this.results[node.id].availability.push(0);
      return false;
    }
  }

  async testGeolocation(node) {
    try {
      const host = node.host_uri.split("//")[1].split(":")[0];
      const geo = geoip.lookup(host); // Note: May need IP resolution
      if (geo) {
        this.results[node.id].geolocation = {
          lat: geo.ll[0],
          lon: geo.ll[1],
          city: geo.city,
          country: geo.country,
        };
        return true;
      }
      this.results[node.id].geolocation = { error: "Geolocation not found" };
      return false;
    } catch (error) {
      console.error(`Geolocation test failed for ${node.id}: ${error.message}`);
      this.results[node.id].geolocation = { error: error.message };
      return false;
    }
  }

  async testComputeAccuracy(node) {
    if (!node.ssh_ip) {
      console.log(`Skipping compute accuracy test for ${node.id}: No SSH IP available`);
      this.results[node.id].computeAccuracy.push(0);
      return false;
    }
    return new Promise((resolve) => {
      const conn = new Client();
      const computeTask = 'echo "print(12345 * 6789)" | python3';
      const expectedResult = (12345 * 6789).toString();
      conn
        .on("ready", () => {
          conn.exec(computeTask, (err, stream) => {
            if (err) {
              this.results[node.id].computeAccuracy.push(0);
              conn.end();
              return resolve(false);
            }
            let output = "";
            stream
              .on("data", (data) => (output += data))
              .on("close", () => {
                const success = output.trim() === expectedResult;
                this.results[node.id].computeAccuracy.push(success ? 1 : 0);
                conn.end();
                resolve(success);
              });
          });
        })
        .on("error", (err) => {
          console.error(`Compute accuracy error for ${node.id}: ${err.message}`);
          this.results[node.id].computeAccuracy.push(0);
          conn.end();
          resolve(false);
        })
        .connect({
          host: node.ssh_ip,
          port: node.ssh_port || 22,
          username: 'root',
          password: 'password',
          readyTimeout: 10000,
        });
    });
  }

  async runUptimeTest(durationSeconds = 60, intervalSeconds = 5) {
    const startTime = Date.now();
    while (Date.now() - startTime < durationSeconds * 1000) {
      this.totalChecks += 1;
      for (const node of this.nodes) {
        if (await this.checkAvailability(node)) {
          this.uptimeChecks[node.id] += 1;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    }
  }

  calculateMetrics() {
    const metrics = {};
    for (const nodeId in this.results) {
      const data = this.results[nodeId];
      metrics[nodeId] = {
        retrievabilityScore:
          (data.retrievability.reduce((a, b) => a + b, 0) / data.retrievability.length) * 100 || 0,
        avgLatency:
          data.latency.reduce((a, b) => a + b, 0) / data.latency.length || Infinity,
        availabilityScore:
          (data.availability.reduce((a, b) => a + b, 0) / data.availability.length) * 100 || 0,
        avgBandwidth:
          data.bandwidth.reduce((a, b) => a + b, 0) / data.bandwidth.length || 0,
        uptimeScore: (this.uptimeChecks[nodeId] / this.totalChecks) * 100 || 0,
        geolocation: data.geolocation,
        computeAccuracyScore:
          (data.computeAccuracy.reduce((a, b) => a + b, 0) / data.computeAccuracy.length) * 100 || 0,
      };
    }
    return metrics;
  }

  static async fetchAkashProviderDetails(providers) {
    const providerData = {
      akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh: { host_uri: "https://provider.provider-02.sandbox-01.aksh.pw:8443" },
    };

    const sshIpMap = {
      akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh: { ssh_ip: "216.153.63.25", ssh_port: 32227 },
    };

    return providers.map((provider) => ({
      id: provider,
      host_uri: providerData[provider]?.host_uri || "https://provider.akashtesting.xyz:8443",
      ssh_ip: sshIpMap[provider]?.ssh_ip || null,
      ssh_port: sshIpMap[provider]?.ssh_port || null,
    }));
  }
}

module.exports = AkashNodeChecker;