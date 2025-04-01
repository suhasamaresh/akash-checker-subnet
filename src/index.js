// ~/akash-checker/src/index.js
const AkashNodeChecker = require('./checker'); // Remove destructuring
const FilecoinStorage = require('./filecoin');
const Visualizer = require('./visualize');
require('dotenv').config();

const TESTNET_PROVIDERS = [
  'akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh', //providers first. Currently this is the only active provider on the akash testnet
];

async function main() {
  try {
    console.log('Fetching Akash provider details...');
    const nodes = await AkashNodeChecker.fetchAkashProviderDetails(TESTNET_PROVIDERS.slice(0, 6)); // Test 6 including your provider
    const checker = new AkashNodeChecker(nodes);

    for (const node of checker.nodes) {
      console.log(`Testing node ${node.id}...`);
      await checker.testRetrievability(node);
      await checker.testBandwidth(node);
      await checker.checkAvailability(node);
      await checker.testGeolocation(node);
      await checker.testComputeAccuracy(node);
    }

    console.log('Running uptime test...');
    await checker.runUptimeTest(60, 5);

    const metrics = checker.calculateMetrics();
    console.log('Node Metrics:', JSON.stringify(metrics, null, 2));

    console.log('Storing results on Filecoin...');
    const filecoinStorage = new FilecoinStorage();
    const cid = await filecoinStorage.store(metrics);
    console.log(`Results stored on Filecoin with CID: ${cid}`);

    console.log('Generating visualizations...');
    const visualizer = new Visualizer(metrics);
    await visualizer.generateVisualizations();
    console.log('Visualizations saved as PNG files.');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

main();