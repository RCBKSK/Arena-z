
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BatchFactory {
    bytes32 public constant BATCH_BYTECODE_HASH = keccak256(type(BatchNFTTransfer).creationCode);
    
    function deployBatch(uint256 salt) external returns (address batch) {
        bytes memory bytecode = type(BatchNFTTransfer).creationCode;
        assembly {
            batch := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(batch != address(0), "Deploy failed");
    }
    
    function getBatchAddress(address deployer, uint256 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(
            address(this),
            keccak256(abi.encodePacked(deployer, salt)),
            address(this)
        );
    }
}
