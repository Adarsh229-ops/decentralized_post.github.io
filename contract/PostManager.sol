// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PostManager {
    struct Post {
        uint256 id;
        address creator;
        string ipfsHash;
        int256 rating;
        uint256 timestamp;
        bool exists;
    }
    
    mapping(uint256 => Post) public posts;
    mapping(uint256 => mapping(address => int8)) public userVotes; // -1, 0, 1
    uint256 public nextPostId;
    
    event PostCreated(uint256 indexed postId, address indexed creator, string ipfsHash);
    event PostVoted(uint256 indexed postId, address indexed voter, int8 vote, int256 newRating);
    
    function createPost(string memory ipfsHash) external returns (uint256) {
        uint256 postId = nextPostId++;
        
        posts[postId] = Post({
            id: postId,
            creator: msg.sender,
            ipfsHash: ipfsHash,
            rating: 0,
            timestamp: block.timestamp,
            exists: true
        });
        
        emit PostCreated(postId, msg.sender, ipfsHash);
        return postId;
    }
    
    function upvotePost(uint256 postId) external {
        require(posts[postId].exists, "Post does not exist");
        _vote(postId, 1);
    }
    
    function downvotePost(uint256 postId) external {
        require(posts[postId].exists, "Post does not exist");
        _vote(postId, -1);
    }
    
    function _vote(uint256 postId, int8 newVote) internal {
        int8 oldVote = userVotes[postId][msg.sender];
        
        // Update user's vote
        userVotes[postId][msg.sender] = newVote;
        
        // Update post rating
        posts[postId].rating = posts[postId].rating - int256(oldVote) + int256(newVote);
        
        emit PostVoted(postId, msg.sender, newVote, posts[postId].rating);
    }
    
    function getPost(uint256 postId) external view returns (Post memory) {
        require(posts[postId].exists, "Post does not exist");
        return posts[postId];
    }
    
    function getAllPosts() external view returns (Post[] memory) {
        Post[] memory allPosts = new Post[](nextPostId);
        uint256 count = 0;
        
        for (uint256 i = 0; i < nextPostId; i++) {
            if (posts[i].exists) {
                allPosts[count] = posts[i];
                count++;
            }
        }
        
        // Resize array to actual count
        Post[] memory result = new Post[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = allPosts[i];
        }
        
        return result;
    }
    
    function getUserVote(uint256 postId, address user) external view returns (int8) {
        return userVotes[postId][user];
    }
}
