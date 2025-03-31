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
      console.log(
        `Skipping retrievability test for ${node.id}: No SSH IP available`
      );
      this.results[node.id].retrievability.push(0);
      this.results[node.id].latency.push(Infinity);
      return false;
    }
    return new Promise(async (resolve) => {
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
                this.results[node.id].latency.push(
                  success ? latency : Infinity
                );
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
            password: 'password', // Add this
            readyTimeout: 10000,
          });
    });
  }

  async testBandwidth(node) {
    if (!node.ssh_ip) {
      console.log(
        `Skipping bandwidth test for ${node.id}: No SSH IP available`
      );
      this.results[node.id].bandwidth.push(0);
      return 0;
    }
    return new Promise(async (resolve) => {
      const conn = new Client();
      const startTime = Date.now();
      conn
        .on("ready", () => {
          conn.sftp(async (err, sftp) => {
            if (err) {
              this.results[node.id].bandwidth.push(0);
              conn.end();
              return resolve(0);
            }
            const testFileSizeMb = 10;
            const testFile = Buffer.alloc(testFileSizeMb * 1024 * 1024, "x");
            await new Promise((res) => {
              sftp.writeFile("/tmp/testfile.bin", testFile, (writeErr) => {
                if (writeErr) {
                  this.results[node.id].bandwidth.push(0);
                  conn.end();
                  res();
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
                  res();
                });
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
            password: 'password', // Add this
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
      console.error(
        `Availability check failed for ${node.id}: ${error.message}`
      );
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
      console.log(
        `Skipping compute accuracy test for ${node.id}: No SSH IP available`
      );
      this.results[node.id].computeAccuracy.push(0);
      return false;
    }
    return new Promise(async (resolve) => {
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
          console.error(
            `Compute accuracy error for ${node.id}: ${err.message}`
          );
          this.results[node.id].computeAccuracy.push(0);
          conn.end();
          resolve(false);
        })
        .connect({
            host: node.ssh_ip,
            port: node.ssh_port || 22,
            username: 'root',
            password: 'password', // Add this
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
      await new Promise((resolve) =>
        setTimeout(resolve, intervalSeconds * 1000)
      );
    }
  }

  calculateMetrics() {
    const metrics = {};
    for (const nodeId in this.results) {
      const data = this.results[nodeId];
      metrics[nodeId] = {
        retrievabilityScore:
          (data.retrievability.reduce((a, b) => a + b, 0) /
            data.retrievability.length) *
            100 || 0,
        avgLatency:
          data.latency.reduce((a, b) => a + b, 0) / data.latency.length ||
          Infinity,
        availabilityScore:
          (data.availability.reduce((a, b) => a + b, 0) /
            data.availability.length) *
            100 || 0,
        avgBandwidth:
          data.bandwidth.reduce((a, b) => a + b, 0) / data.bandwidth.length ||
          0,
        uptimeScore: (this.uptimeChecks[nodeId] / this.totalChecks) * 100 || 0,
        geolocation: data.geolocation,
        computeAccuracyScore:
          (data.computeAccuracy.reduce((a, b) => a + b, 0) /
            data.computeAccuracy.length) *
            100 || 0,
      };
    }
    return metrics;
  }

  static async fetchAkashProviderDetails(providers) {
    const providerData = {
      akash1q920mpw6fravanffwv039rnq3vzewjkcz68t4j: {
        host_uri: "https://provider.chichaaa.store:8443",
      },
      akash1qt5jjuhwffddjpk2vn7696s6y6c0lwfv2ggetz: {
        host_uri: "https://provider.akashtestprovider.xyz:8443",
      },
      akash1qlpzq9vyy77w359shc63rrzsz066wprtuwcflz: {
        host_uri: "https://provider.testnet20.praetor.dev:8443",
      },
      akash1pp8pmchlgp8aj3v28pjsz7nmf64j5v8af8283r: {
        host_uri: "https://provider.zp13.praetor.dev:8443",
      },
      akash1px8cp44z8gpr6r8hpxdeftjrsqnux9v7935tuv: {
        host_uri: "https://provider.vp99.praetor.dev:8443",
      },
      akash1pxc0qhmdlhnjczt9eysvmrca6upglzexza3a2f: {
        host_uri: "https://provider.gpu-test.testcoders.com:8443",
      },
      akash1pef58urex2nnufny5zxlnee7pr2mkxxq8q4e9w: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1r9c6h7wyedhm9ah6eqhp58ku53mx7pcw5f0z89: {
        host_uri: "https://provider.testnet22.praetor.dev:8443",
      },
      akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh: {
        host_uri: "https://provider.provider-02.sandbox-01.aksh.pw:8443",
      },
      akash19paynaclplzg0kjxy8emusk6t4dn9me8tchfuf: {
        host_uri: "https://provider.gokulcodes.xyz:8443",
      },
      akash19egkussqt0fh3ahwvuw75zq6yyh7lm8kkxq9c4: {
        host_uri: "https://provider.demo.origin-ml.com:8443",
      },
      akash1xyh84jed7ckpdwxc7cpnw7te38lwa89nr2um25: {
        host_uri: "https://provider.zp11.praetor.dev:8443",
      },
      akash1x9qc7czncvmv7psvlyjv3hwjfwxph5xfy9dvrr: {
        host_uri: "https://provider.nxql.bhuceramics.store:8443",
      },
      akash1xgm2tsrx37j3f5c26frfym66djyk68dep8rdq0: {
        host_uri: "https://provider.vp50.praetor.dev:8443",
      },
      akash1xs40xcm8sa6pqffyzlm27kq235sac2qmpugzna: {
        host_uri: "https://provider.gokulcodes.xyz:8443",
      },
      akash18yr7stgp7rntdg6sj47r4khw8wzy9qr0zvg0hq: {
        host_uri: "https://provider.gokulcodes.xyz:8443",
      },
      akash184a7vxfs536pxcd4rmvfl9tpv3xfkmrg3k95z4: {
        host_uri: "https://provider.akashost.duckdns.org:8443",
      },
      akash1ggk74pf9avxh3llu30yfhmr345h2yrpf7c2cdu: {
        host_uri: "https://provider.akashtestprovider.xyz:8443",
      },
      akash1259s4wahrvr6v8pr4fxz68fnhwk2ntw4uqcdyn: {
        host_uri: "https://provider.domain.com:8443",
      },
      akash1tt2eap6mcfce78p5yes89ydmxluet8ed7jx5w4: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1tvxyeqhknyxzv5rm44wwusz4fkhg8yudhqx0ay: {
        host_uri: "https://provider.zp18.praetor.dev:8443",
      },
      akash1v2ww5v8q04g50p0p8sa089t8j72kgkzgcw0hc3: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1vethjdwpjuvfx77xf0gzgqpntndgmjp4wh8eu4: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1dyzm6paysqh3v62syfah04dj4eu3x73ytt84c7: {
        host_uri: "https://provider.a100.iah.test.akash.test:8443",
      },
      akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu: {
        host_uri: "https://provider.europlots-sandbox.com:8443",
      },
      akash1w3k6qpr4uz44py4z68chfrl7ltpxwtkngnc6xk: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1wlry5lt90vf3f5ntyv5n95t63uh9x8udh8chm0: {
        host_uri: "https://provider.sb01.cypherpunklabs.uk:8443",
      },
      akash1sjwfrn6ksxsse0ett7ju0navh6nlzucpqpf2vq: {
        host_uri: "https://provider.chichaaa.store:8443",
      },
      akash1schuvtg3y2tn3j3wnqt3ywk96gpk0ktnkzlran: {
        host_uri: "https://provider.t1.testcoders.com:8443",
      },
      akash1scc9dwpg8lm7tr28lusmtr69wwnyj3mssk099n: {
        host_uri: "https://provider.pablozsc.ru:8443",
      },
      akash133fr5pdkl9xk8gg79um3zc84eunymluvqsvfz8: {
        host_uri: "https://provider.sandbox-01.aksh.pw:8443",
      },
      akash1j7ceksvzfe7e8782fr73j645mjwl70svuysuqn: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1nxpu5u8j8skjaaens83gqf5f66snzqdws2vfqf: {
        host_uri: "https://provider.sb03.cypherpunklabs.uk:8443",
      },
      akash15nyy6s6jtau0rj7whngyhxxx00tcj66dg4luz5: {
        host_uri: "https://provider.vp98.praetor.dev:8443",
      },
      akash143ypn84kuf379tv9wvcxsmamhj83d5pg2rfc8v: {
        host_uri: "https://provider.shimpa.org:8443",
      },
      akash1474snv59vl6kq0afrzfkwcyr8n5dfxjxfldkzy: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1efccq6mcen6udzxj282fw43jygs7v87vcl94k4: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1mpt69g7lcqnyndnwcyywy7fp7v3p5lcdyehenq: {
        host_uri: "https://provider.euroakash.com:8443",
      },
      akash1mtnuc449l0mckz4cevs835qg72nvqwlul5wzyf: {
        host_uri: "https://provider.akashtesting.xyz:8443",
      },
      akash1m3xxehhnmuuah8rg5hvq79mu5nl92nc86f22nn: {
        host_uri: "https://provider.test2.praetorapp.com:8443",
      },
      akash172k6nk8sazt74t57yt2lx4us63zedgksl45e96: {
        host_uri: "https://provider.euroakash.net:8443",
      },
      akash1l7sphzh47j6xdfsphr52t30qc0snr0f4mhkpje: {
        host_uri: "https://provider.testnet19.praetor.dev:8443",
      },
      akash1ll90m5xlele99tl22jjpp5cdteqrxdls663mg5: {
        host_uri: "https://provider.zp15.praetor.dev:8443",
      },
      // Note: 'akash1ll30a4qnnwffjfzlxkzv8hqgv8nq0f6c4qwnwy' missing from your TESTNET_PROVIDERS
    };

    // For SSH tests, add real workload IPs here after deployment
    const sshIpMap = {
      akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh: {
        ssh_ip: "216.153.63.25",
        ssh_port: 32227,
      },
    };

    return providers.map((provider) => ({
      id: provider,
      host_uri:
        providerData[provider]?.host_uri ||
        "https://provider.akashtesting.xyz:8443",
      ssh_ip: sshIpMap[provider]?.ssh_ip || null,
      ssh_port: sshIpMap[provider]?.ssh_port || null,
    }));
  }
}

module.exports = AkashNodeChecker;
