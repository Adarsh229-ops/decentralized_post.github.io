class DecentralizedPostsApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractInfo = null;
        this.userAddress = null;
        
        this.init();
    }
    
    async init() {
        await this.loadContractInfo();
        this.setupEventListeners();
        await this.loadPosts();
        
        // Check if wallet is already connected
        if (window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await this.connectWallet();
            }
        }
    }
    
    async loadContractInfo() {
        try {
            const response = await fetch('http://localhost:3001/api/contract-info');
            if (response.ok) {
                this.contractInfo = await response.json();
                console.log('Contract info loaded:', this.contractInfo);
            } else {
                console.error('Contract not deployed yet');
            }
        } catch (error) {
            console.error('Failed to load contract info:', error);
        }
    }
    
    setupEventListeners() {
        document.getElementById('connect-wallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('post-form').addEventListener('submit', (e) => this.handleCreatePost(e));
        document.getElementById('refresh-posts').addEventListener('click', () => this.loadPosts());
    }
    
    async connectWallet() {
        try {
            if (!window.ethereum) {
                alert('Please install MetaMask to use this application');
                return;
            }
            
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = accounts[0];
            
            if (this.contractInfo) {
                this.contract = new ethers.Contract(
                    this.contractInfo.address,
                    this.contractInfo.abi,
                    this.signer
                );
            }
            
            // Update UI
            document.getElementById('connect-wallet').textContent = 'Connected';
            document.getElementById('connect-wallet').disabled = true;
            document.getElementById('wallet-address').textContent = `${this.userAddress.substring(0, 6)}...${this.userAddress.substring(38)}`;
            
            console.log('Wallet connected:', this.userAddress);
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet');
        }
    }
    
    async handleCreatePost(e) {
        e.preventDefault();
        
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const author = document.getElementById('post-author').value.trim();
        
        if (!title || !content) {
            this.showStatus('Please fill in title and content', 'error');
            return;
        }
        
        if (!this.contract) {
            this.showStatus('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            this.showStatus('Creating post on IPFS...', 'success');
            
            // Step 1: Store on IPFS via backend
            const response = await fetch('http://localhost:3001/api/createPost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, author })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            this.showStatus('Post stored on IPFS. Creating on blockchain...', 'success');
            
            // Step 2: Create post on blockchain
            const tx = await this.contract.createPost(result.ipfsHash);
            this.showStatus('Transaction sent. Waiting for confirmation...', 'success');
            
            await tx.wait();
            this.showStatus('Post created successfully! 🎉', 'success');
            
            // Clear form
            document.getElementById('post-form').reset();
            
            // Reload posts
            setTimeout(() => this.loadPosts(), 2000);
            
        } catch (error) {
            console.error('Error creating post:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }
    
    async loadPosts() {
        try {
            document.getElementById('posts-container').innerHTML = '<div class="loading">Loading posts...</div>';
            
            const response = await fetch('http://localhost:3001/api/posts');
            const data = await response.json();
            
            if (data.posts && data.posts.length > 0) {
                this.renderPosts(data.posts);
            } else {
                document.getElementById('posts-container').innerHTML = '<div class="loading">No posts found. Create the first one!</div>';
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            document.getElementById('posts-container').innerHTML = '<div class="loading">Error loading posts</div>';
        }
    }
    
    renderPosts(posts) {
        const container = document.getElementById('posts-container');
        
        // Sort posts by timestamp (newest first)
        posts.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        
        container.innerHTML = posts.map(post => `
            <div class="post">
                <div class="post-header">
                    <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
                    <div class="post-meta">
                        <div class="creator-address">By: ${post.creator.substring(0, 6)}...${post.creator.substring(38)}</div>
                        <div>Author: ${this.escapeHtml(post.author)}</div>
                        <div>${new Date(parseInt(post.timestamp) * 1000).toLocaleString()}</div>
                        <div class="post-hash">IPFS: ${post.ipfsHash}</div>
                    </div>
                </div>
                <div class="post-content">${this.escapeHtml(post.content)}</div>
                <div class="post-footer">
                    <div class="post-actions">
                        <button class="vote-btn upvote" onclick="app.vote(${post.id}, true)">
                            👍 Upvote
                        </button>
                        <button class="vote-btn downvote" onclick="app.vote(${post.id}, false)">
                            👎 Downvote
                        </button>
                    </div>
                    <div class="post-rating">
                        Rating: ${post.rating}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async vote(postId, isUpvote) {
        try {
            if (!this.contract) {
                alert('Please connect your wallet first');
                return;
            }
            
            this.showStatus(`${isUpvote ? 'Upvoting' : 'Downvoting'} post...`, 'success');
            
            const tx = isUpvote 
                ? await this.contract.upvotePost(postId)
                : await this.contract.downvotePost(postId);
                
            this.showStatus('Vote submitted. Waiting for confirmation...', 'success');
            
            await tx.wait();
            this.showStatus('Vote confirmed! 🎉', 'success');
            
            // Reload posts to show updated ratings
            setTimeout(() => this.loadPosts(), 2000);
            
        } catch (error) {
            console.error('Error voting:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }
    
    showStatus(message, type) {
        const statusDiv = document.getElementById('create-status');
        statusDiv.textContent = message;
        statusDiv.className = type;
        statusDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new DecentralizedPostsApp();
});