
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BatchProxy.sol";

contract BatchFactory {
    event BatchContractDeployed(address indexed deployer, address batchContract, uint256 salt);
    
    /**
     * @dev Deploy a new BatchNFTTransfer contract using CREATE2
     * @param salt Unique salt for deterministic address generation
     * @return batchContract Address of the deployed contract
     */
    function deployBatch(uint256 salt) external returns (address batchContract) {
        bytes memory bytecode = type(BatchNFTTransfer).creationCode;
        bytes32 finalSalt = keccak256(abi.encodePacked(msg.sender, salt));
        
        assembly {
            batchContract := create2(0, add(bytecode, 0x20), mload(bytecode), finalSalt)
        }
        
        require(batchContract != address(0), "BatchFactory: Deploy failed");
        
        emit BatchContractDeployed(msg.sender, batchContract, salt);
    }
    
    /**
     * @dev Predict the address of a BatchNFTTransfer contract before deployment
     * @param deployer Address of the deployer
     * @param salt Salt used for deployment
     * @return predicted Predicted contract address
     */
    function getBatchAddress(address deployer, uint256 salt) external view returns (address predicted) {
        bytes32 bytecodeHash = keccak256(type(BatchNFTTransfer).creationCode);
        bytes32 finalSalt = keccak256(abi.encodePacked(deployer, salt));
        
        predicted = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            finalSalt,
            bytecodeHash
        )))));
    }
    
    /**
     * @dev Check if a batch contract exists at the predicted address
     * @param deployer Address of the deployer
     * @param salt Salt used for deployment
     * @return exists True if contract exists
     */
    function batchExists(address deployer, uint256 salt) external view returns (bool exists) {
        address predicted = this.getBatchAddress(deployer, salt);
        uint256 size;
        assembly {
            size := extcodesize(predicted)
        }
        return size > 0;
    }
}
