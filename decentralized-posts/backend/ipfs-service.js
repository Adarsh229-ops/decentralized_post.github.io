const { create } = require('ipfs-http-client');

class IpfsService {
  constructor() {
    this.ipfs = null;
  }
  
  async init() {
    try {
      // Connect to local IPFS node
      this.ipfs = create({
        host: 'localhost',
        port: 5001,
        protocol: 'http'
      });
      
      // Test connection
      const version = await this.ipfs.version();
      console.log('Connected to IPFS node version:', version.version);
    } catch (error) {
      console.error('Failed to connect to IPFS:', error);
      throw error;
    }
  }
  
  async storePost(postData) {
    try {
      const result = await this.ipfs.add(JSON.stringify(postData));
      return result.cid.toString();
    } catch (error) {
      console.error('Error storing post on IPFS:', error);
      throw error;
    }
  }
  
  async getPost(hash) {
    try {
      const chunks = [];
      for await (const chunk of this.ipfs.cat(hash)) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      console.error('Error retrieving post from IPFS:', error);
      throw error;
    }
  }
}

module.exports = IpfsService;