const lighthouse = require('@lighthouse-web3/sdk');
const fs = require('fs').promises;
require('dotenv').config();

class FilecoinStorage {
  constructor() {
    this.apiKey = process.env.LIGHTHOUSE_API_KEY;
  }

  async store(data) {
    const filename = `akash_checker_results_${new Date().toISOString()}.json`;
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    const uploadResponse = await lighthouse.upload(filename, this.apiKey);
    await fs.unlink(filename);
    return uploadResponse.data.Hash; // CID
  }
}

module.exports = FilecoinStorage;