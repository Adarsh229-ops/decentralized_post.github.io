const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const IpfsService = require('./ipfs-service');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
let contract;
let provider;
let ipfsService;

async function initializeServices() {
  try {
    // Initialize IPFS
    ipfsService = new IpfsService();
    await ipfsService.init();
    console.log('IPFS service initialized');
    
    // Initialize blockchain connection
    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // Load contract info
    const contractInfoPath = path.join(__dirname, '../contract-info.json');
    if (fs.existsSync(contractInfoPath)) {
      const contractInfo = JSON.parse(fs.readFileSync(contractInfoPath, 'utf8'));
      contract = new ethers.Contract(contractInfo.address, contractInfo.abi, provider);
      console.log('Contract connected at:', contractInfo.address);
    } else {
      console.error('Contract info not found. Please deploy the contract first.');
    }
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Routes
app.post('/api/createPost', async (req, res) => {
  try {
    const { title, content, author } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Create post object
    const postData = {
      title,
      content,
      author: author || 'Anonymous',
      timestamp: new Date().toISOString()
    };
    
    // Store on IPFS
    const ipfsHash = await ipfsService.storePost(postData);
    console.log('Post stored on IPFS:', ipfsHash);
    
    res.json({ 
      success: true, 
      ipfsHash,
      message: 'Post stored on IPFS. Now create it on blockchain via frontend.' 
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: 'Contract not initialized' });
    }
    
    // Get all posts from contract
    const contractPosts = await contract.getAllPosts();
    
    // Fetch IPFS content for each post
    const posts = await Promise.all(
      contractPosts.map(async (post) => {
        try {
          const ipfsData = await ipfsService.getPost(post.ipfsHash);
          return {
            id: post.id.toString(),
            creator: post.creator,
            ipfsHash: post.ipfsHash,
            rating: post.rating.toString(),
            timestamp: post.timestamp.toString(),
            ...ipfsData
          };
        } catch (error) {
          console.error(`Error fetching IPFS data for post ${post.id}:`, error);
          return {
            id: post.id.toString(),
            creator: post.creator,
            ipfsHash: post.ipfsHash,
            rating: post.rating.toString(),
            timestamp: post.timestamp.toString(),
            title: 'Error loading content',
            content: 'Could not load post content from IPFS',
            author: 'Unknown'
          };
        }
      })
    );
    
    res.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.get('/api/post/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const postData = await ipfsService.getPost(hash);
    res.json(postData);
  } catch (error) {
    console.error('Error fetching post from IPFS:', error);
    res.status(500).json({ error: 'Failed to fetch post from IPFS' });
  }
});

app.get('/api/contract-info', (req, res) => {
  try {
    const contractInfoPath = path.join(__dirname, '../contract-info.json');
    if (fs.existsSync(contractInfoPath)) {
      const contractInfo = JSON.parse(fs.readFileSync(contractInfoPath, 'utf8'));
      res.json(contractInfo);
    } else {
      res.status(404).json({ error: 'Contract not deployed yet' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load contract info' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    ipfs: ipfsService ? 'connected' : 'disconnected',
    contract: contract ? 'connected' : 'disconnected'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  await initializeServices();
});