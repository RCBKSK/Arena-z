
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract BatchTransfer {
    
    function batchTransferFrom(
        address nftContract,
        address to,
        uint256[] calldata tokenIds
    ) external {
        IERC721 nft = IERC721(nftContract);
        
        // Check if this contract is approved to transfer all tokens
        require(
            nft.isApprovedForAll(msg.sender, address(this)),
            "Contract not approved for all tokens"
        );
        
        // Transfer each token
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Verify ownership
            require(
                nft.ownerOf(tokenIds[i]) == msg.sender,
                "Not owner of token"
            );
            
            // Transfer the token
            nft.safeTransferFrom(msg.sender, to, tokenIds[i]);
        }
    }
    
    function batchTransferMultipleRecipients(
        address nftContract,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external {
        require(recipients.length == tokenIds.length, "Arrays length mismatch");
        
        IERC721 nft = IERC721(nftContract);
        require(
            nft.isApprovedForAll(msg.sender, address(this)),
            "Contract not approved for all tokens"
        );
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                nft.ownerOf(tokenIds[i]) == msg.sender,
                "Not owner of token"
            );
            
            nft.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
        }
    }
}
