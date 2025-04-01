I understand—since `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh` is the *only* provider available on the Akash testnet, we’ll update the `README.md` to remove any implication that other providers in `TESTNET_PROVIDERS` are testable or relevant for SSH tests. We’ll streamline it to focus exclusively on this single provider, avoiding confusion about skipped tests for others. Here’s the revised version:

---

# Akash Checker Subnet

A Node.js application to evaluate the sole Akash testnet provider by testing metrics like availability, latency, geolocation, retrievability, bandwidth, and compute accuracy. Results are stored on Filecoin (via Lighthouse) and visualized as charts.

## Overview

This project runs on the Akash testnet (`sandbox-01`) with deployments to evaluate the only available provider: `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh` (SSH endpoint: `216.153.63.25:32227`). Deployments are required for SSH-based tests, using testnet AKT (free via faucet). No other providers are active on the testnet at this time.

## Prerequisites

- **Node.js**: v16+ (install via `nvm` or package manager).
- **Akash CLI**: Install via [Akash Docs](https://akash.network/docs/getting-started/installation/).
- **Testnet Wallet**: Funded with testnet AKT (via faucet, e.g., Akash Discord).
- **Dependencies**: Install with `npm install`.

## Setup

1. **Clone the Repository**:
   ```bash
   git clone <your-repo-url>
   cd akash-checker
   ```

2. **Install Dependencies**:
   ```bash
   npm install axios ping geoip-lite ssh2 @lighthouse-web3/sdk chart.js chartjs-to-image dotenv
   ```

3. **Configure Environment**:
   - Create `.env` in the root directory:
     ```
     AKASH_KEY_NAME=suhas
     AKASH_NODE=http://sandbox-01.aksh.pw:26657
     AKASH_CHAIN_ID=sandbox-01
     LIGHTHOUSE_API_KEY=your-lighthouse-api-key
     ```
   - Replace `suhas` with your Akash key name (see below).
   - Get a Lighthouse API key from [Lighthouse](https://www.lighthouse.storage/).

4. **Set Up Akash Key**:
   - List keys: `akash keys list`
   - Add a key if needed: `akash keys add suhas` (save the mnemonic).
   - Verify address: `akash keys show suhas -a` (e.g., `akash1549z93ma6y77zvgw4gup053d5dteh9rt6wr8z5`).

5. **Get Testnet Funds**:
   - Request testnet AKT from a faucet (e.g., Akash Discord).
   - Check balance: `akash query bank balances $(akash keys show suhas -a) --node http://sandbox-01.aksh.pw:26657`.

## Files

- **`src/checker.js`**: Defines `AkashNodeChecker` class for testing the provider, including SSH-based tests.
- **`src/filecoin.js`**: Stores results on Filecoin via Lighthouse.
- **`src/index.js`**: Main script to run tests and generate outputs.
- **`src/visualize.js`**: Creates bar charts from metrics.
- **`deploy.yml`**: Defines the `ssh-test` workload (Ubuntu with SSH).

## Running with Testnet Deployments

The Akash testnet has only one provider: `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`. Follow these steps to run tests.

### Step 1: Verify Existing Deployment
- This project assumes a deployment (`dseq: 9715018`) is active for `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`.
- Check in [Akash Console](https://console.akash.network/):
  - Address: `akash1549z93ma6y77zvgw4gup053d5dteh9rt6wr8z5`
  - Look for `dseq: 9715018` with URI `216.153.63.25:32227`.
- If not active, deploy manually:
  ```bash
  akash tx deployment create ~/akash-checker/deploy.yml --from suhas --node http://sandbox-01.aksh.pw:26657 --chain-id sandbox-01 --gas auto -y
  akash tx market lease create --from suhas --node http://sandbox-01.aksh.pw:26657 --chain-id sandbox-01 --dseq <new-dseq> --provider akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh --gas auto -y
  ```
  - Upload `deploy.yml` in Akash Console for the new `dseq`.
  - Note the new SSH endpoint (e.g., `216.153.63.25:32227`).

### Step 2: Update `checker.js`
- Ensure `sshIpMap` in `src/checker.js` reflects the active deployment:
  ```javascript
  const sshIpMap = {
    akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh: { ssh_ip: "216.153.63.25", ssh_port: 32227 },
  };
  ```
- Update the IP/port if your new deployment differs.

### Step 3: Run Tests
```bash
npm start
```
- Runs tests solely against `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`, the only testnet provider.
- Ignores other entries in `TESTNET_PROVIDERS` as no other providers are active.

### Output
- **Console**: Metrics in JSON format (e.g., retrievability, bandwidth, compute accuracy for `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`).
- **Filecoin**: CID of stored results (e.g., `Qm...`).
- **Visualizations**: PNG files (e.g., `retrievability.png`, `bandwidth.png`) showing data for the single provider.

## Notes

- **Single Provider Limitation**: The testnet (`sandbox-01`) currently supports only `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`. No other providers are available.
- **Testnet Only**: This setup uses free testnet AKT. Mainnet deployment requires real AKT and more active providers.

## Troubleshooting

- **Key Errors**: Verify `AKASH_KEY_NAME` with `akash keys list`.
- **No Funds**: Check balance and request testnet AKT.
- **SSH Fails**: Test manually (`ssh root@216.153.63.25 -p 32227`), ensure deployment is active.
- **No Metrics**: Confirm `sshIpMap` matches your deployment’s URI.

## Mainnet Considerations

- Update `.env`:
  ```
  AKASH_NODE=https://rpc.akash.network:443
  AKASH_CHAIN_ID=akashnet-2
  ```
- Fund wallet with real AKT (~0.01 AKT per deployment).
- Replace `TESTNET_PROVIDERS` with mainnet provider list (query via `akash query provider list --node https://rpc.akash.network:443`).
- Expect multiple active providers on mainnet.

## Contributing

Feel free to fork, modify, and submit PRs to support additional providers or mainnet.

---

### Notes for You
- Save this as `README.md` in `~/akash-checker/`.
- Replace `<your-repo-url>` with your GitHub link if applicable.
- This aligns with your statement that `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh` is the only testnet provider, so no other providers in `TESTNET_PROVIDERS` are relevant for now.

Let’s confirm it works. Run `npm start` and share the output—did it generate metrics for `akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh`? If it run successfully , it'll generate all the related images in the same directory.