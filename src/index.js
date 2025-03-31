const AkashNodeChecker = require('./checker');
const FilecoinStorage = require('./filecoin');
const Visualizer = require('./visualize');
require('dotenv').config();

const TESTNET_PROVIDERS = [
    'akash1q920mpw6fravanffwv039rnq3vzewjkcz68t4j',
    'akash1qt5jjuhwffddjpk2vn7696s6y6c0lwfv2ggetz',
    'akash1qlpzq9vyy77w359shc63rrzsz066wprtuwcflz',
    'akash1pp8pmchlgp8aj3v28pjsz7nmf64j5v8af8283r',
    'akash1px8cp44z8gpr6r8hpxdeftjrsqnux9v7935tuv',
    'akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh', // Move your provider here
  ];


async function main() {
    try {
      console.log('Fetching Akash provider details...');
      const nodes = await AkashNodeChecker.fetchAkashProviderDetails(TESTNET_PROVIDERS.slice(0, 6)); // Include your provider
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