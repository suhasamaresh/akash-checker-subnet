// ~/akash-checker/deploy-all.js
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const execPromise = util.promisify(exec);

const TESTNET_PROVIDERS = [
  'akash1q920mpw6fravanffwv039rnq3vzewjkcz68t4j',
  'akash1qt5jjuhwffddjpk2vn7696s6y6c0lwfv2ggetz',
  'akash1qlpzq9vyy77w359shc63rrzsz066wprtuwcflz',
  'akash1pp8pmchlgp8aj3v28pjsz7nmf64j5v8af8283r',
  'akash1px8cp44z8gpr6r8hpxdeftjrsqnux9v7935tuv',
  'akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh',
  'akash1pxc0qhmdlhnjczt9eysvmrca6upglzexza3a2f',
  'akash1pef58urex2nnufny5zxlnee7pr2mkxxq8q4e9w',
  'akash1r9c6h7wyedhm9ah6eqhp58ku53mx7pcw5f0z89',
  'akash19paynaclplzg0kjxy8emusk6t4dn9me8tchfuf',
  'akash19egkussqt0fh3ahwvuw75zq6yyh7lm8kkxq9c4',
  'akash1xyh84jed7ckpdwxc7cpnw7te38lwa89nr2um25',
  'akash1x9qc7czncvmv7psvlyjv3hwjfwxph5xfy9dvrr',
  'akash1xgm2tsrx37j3f5c26frfym66djyk68dep8rdq0',
  'akash1xs40xcm8sa6pqffyzlm27kq235sac2qmpugzna',
  'akash18yr7stgp7rntdg6sj47r4khw8wzy9qr0zvg0hq',
  'akash184a7vxfs536pxcd4rmvfl9tpv3xfkmrg3k95z4',
  'akash1ggk74pf9avxh3llu30yfhmr345h2yrpf7c2cdu',
  'akash1259s4wahrvr6v8pr4fxz68fnhwk2ntw4uqcdyn',
  'akash1tt2eap6mcfce78p5yes89ydmxluet8ed7jx5w4',
  'akash1tvxyeqhknyxzv5rm44wwusz4fkhg8yudhqx0ay',
  'akash1v2ww5v8q04g50p0p8sa089t8j72kgkzgcw0hc3',
  'akash1vethjdwpjuvfx77xf0gzgqpntndgmjp4wh8eu4',
  'akash1dyzm6paysqh3v62syfah04dj4eu3x73ytt84c7',
  'akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu',
  'akash1w3k6qpr4uz44py4z68chfrl7ltpxwtkngnc6xk',
  'akash1wlry5lt90vf3f5ntyv5n95t63uh9x8udh8chm0',
  'akash1sjwfrn6ksxsse0ett7ju0navh6nlzucpqpf2vq',
  'akash1schuvtg3y2tn3j3wnqt3ywk96gpk0ktnkzlran',
  'akash1scc9dwpg8lm7tr28lusmtr69wwnyj3mssk099n',
  'akash133fr5pdkl9xk8gg79um3zc84eunymluvqsvfz8',
  'akash1j7ceksvzfe7e8782fr73j645mjwl70svuysuqn',
  'akash1nxpu5u8j8skjaaens83gqf5f66snzqdws2vfqf',
  'akash15nyy6s6jtau0rj7whngyhxxx00tcj66dg4luz5',
  'akash143ypn84kuf379tv9wvcxsmamhj83d5pg2rfc8v',
  'akash1474snv59vl6kq0afrzfkwcyr8n5dfxjxfldkzy',
  'akash1efccq6mcen6udzxj282fw43jygs7v87vcl94k4',
  'akash1mpt69g7lcqnyndnwcyywy7fp7v3p5lcdyehenq',
  'akash1mtnuc449l0mckz4cevs835qg72nvqwlul5wzyf',
  'akash1m3xxehhnmuuah8rg5hvq79mu5nl92nc86f22nn',
  'akash172k6nk8sazt74t57yt2lx4us63zedgksl45e96',
  'akash1l7sphzh47j6xdfsphr52t30qc0snr0f4mhkpje',
  'akash1ll90m5xlele99tl22jjpp5cdteqrxdls663mg5'
];

const DEPLOY_YML = '~/akash-checker/deploy.yml';
const AKASH_KEY_NAME = process.env.AKASH_KEY_NAME || 'your-key-name';
const AKASH_NODE = process.env.AKASH_NODE || 'http://sandbox-01.aksh.pw:26657';
const AKASH_CHAIN_ID = process.env.AKASH_CHAIN_ID || 'sandbox-01';
const AKASH_ACCOUNT_ADDRESS = 'akash1549z93ma6y77zvgw4gup053d5dteh9rt6wr8z5';

async function deployToProvider(provider) {
  try {
    // Step 1: Create Deployment
    const deployCmd = `akash tx deployment create ${DEPLOY_YML} --from ${AKASH_KEY_NAME} --node ${AKASH_NODE} --chain-id ${AKASH_CHAIN_ID} --gas auto -y`;
    const { stdout: deployOut } = await execPromise(deployCmd);
    const dseqMatch = deployOut.match(/"dseq":"(\d+)"/);
    if (!dseqMatch) throw new Error('No dseq found');
    const dseq = dseqMatch[1];
    console.log(`Created deployment ${dseq} for ${provider}`);

    // Step 2: Create Lease
    const leaseCmd = `akash tx market lease create --from ${AKASH_KEY_NAME} --node ${AKASH_NODE} --chain-id ${AKASH_CHAIN_ID} --dseq ${dseq} --provider ${provider} --gas auto -y`;
    await execPromise(leaseCmd);
    console.log(`Created lease for ${dseq} with ${provider}`);

    // Step 3: Manual Manifest Upload Prompt
    console.log(`Please upload deploy.yml to ${dseq} in Akash Console: https://console.akash.network/`);

    // Step 4: Fetch SSH Endpoint (adjust URL per provider)
    const providerUri = provider === 'akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh' 
      ? 'https://provider.provider-02.sandbox-01.aksh.pw:8443'
      : 'https://provider.akashtesting.xyz:8443'; // Fallback, update as needed
    const statusUrl = `${providerUri}/lease/${dseq}/1/1/${AKASH_ACCOUNT_ADDRESS}/${provider}/status`;
    const { stdout: statusOut } = await execPromise(`curl -s "${statusUrl}"`);
    const status = JSON.parse(statusOut);
    const forwardedPort = status.services?.['ssh-test']?.uris?.[0] || status.forwarded_ports?.['22'];
    if (!forwardedPort) throw new Error('No forwarded port found');

    let sshIp, sshPort;
    if (forwardedPort.includes(':')) {
      [sshIp, sshPort] = forwardedPort.split(':');
    } else {
      sshIp = provider === 'akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh' ? '216.153.63.25' : 'unknown'; // Resolve dynamically in production
      sshPort = forwardedPort;
    }

    return { provider, ssh_ip: sshIp, ssh_port: parseInt(sshPort) };
  } catch (error) {
    console.error(`Failed for ${provider}: ${error.message}`);
    return null;
  }
}

async function main() {
  const sshIpMap = {};
  for (const provider of TESTNET_PROVIDERS.slice(0, 3)) { // Test with 3 for now
    const result = await deployToProvider(provider);
    if (result) {
      sshIpMap[provider] = { ssh_ip: result.ssh_ip, ssh_port: result.ssh_port };
    }
  }

  // Update checker.js
  const checkerContent = `const axios = require("axios");\n` +
    `const ping = require("ping");\n` +
    `const geoip = require("geoip-lite");\n` +
    `const { Client } = require("ssh2");\n` +
    `const fs = require("fs").promises;\n\n` +
    `const sshIpMap = ${JSON.stringify(sshIpMap, null, 2)};\n\n` +
    `class AkashNodeChecker {\n` + // Rest of your checker.js content
    fs.readFileSync('./src/checker.js', 'utf8').split('class AkashNodeChecker {')[1] +
    `module.exports = AkashNodeChecker;\n`;
  await fs.writeFile('./src/checker.js', checkerContent);
  console.log('Updated checker.js with new sshIpMap');
}

main().catch(console.error);