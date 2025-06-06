
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
}

/**
 * @title SimpleBatchTransfer
 * @dev A simple batch transfer contract that users can deploy themselves
 * No factory needed - each user deploys their own instance
 */
contract SimpleBatchTransfer {
    address public immutable owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Only the contract owner can use batch transfers
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can use this");
        _;
    }
    
    /**
     * @dev Batch transfer multiple NFTs to different recipients
     * @param nftContract The NFT contract address
     * @param recipients Array of recipient addresses
     * @param tokenIds Array of token IDs to transfer
     */
    function batchTransfer(
        address nftContract,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external onlyOwner {
        require(recipients.length == tokenIds.length, "Arrays length mismatch");
        require(recipients.length > 0, "No transfers specified");
        
        IERC721 nft = IERC721(nftContract);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Verify sender owns the token
            require(nft.ownerOf(tokenIds[i]) == owner, "Not token owner");
            
            // Check if this contract is approved
            require(
                nft.isApprovedForAll(owner, address(this)) || 
                nft.getApproved(tokenIds[i]) == address(this),
                "Contract not approved for transfer"
            );
            
            // Transfer the NFT
            nft.safeTransferFrom(owner, recipients[i], tokenIds[i]);
        }
    }
    
    /**
     * @dev Batch transfer multiple NFTs to a single recipient
     * @param nftContract The NFT contract address
     * @param recipient The recipient address
     * @param tokenIds Array of token IDs to transfer
     */
    function batchTransferToSingle(
        address nftContract,
        address recipient,
        uint256[] calldata tokenIds
    ) external onlyOwner {
        require(tokenIds.length > 0, "No transfers specified");
        require(recipient != address(0), "Invalid recipient");
        
        IERC721 nft = IERC721(nftContract);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Verify sender owns the token
            require(nft.ownerOf(tokenIds[i]) == owner, "Not token owner");
            
            // Check if this contract is approved
            require(
                nft.isApprovedForAll(owner, address(this)) || 
                nft.getApproved(tokenIds[i]) == address(this),
                "Contract not approved for transfer"
            );
            
            // Transfer the NFT
            nft.safeTransferFrom(owner, recipient, tokenIds[i]);
        }
    }
}
