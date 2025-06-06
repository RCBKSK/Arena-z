
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying BatchNFTTransfer contract...");

  // Get the contract factory
  const BatchNFTTransfer = await ethers.getContractFactory("BatchNFTTransfer");

  // Deploy the contract
  const batchTransfer = await BatchNFTTransfer.deploy();
  await batchTransfer.waitForDeployment();

  const contractAddress = await batchTransfer.getAddress();
  
  console.log("BatchNFTTransfer deployed to:", contractAddress);
  console.log("Explorer URL:", `https://explorer.arena-z.gg/address/${contractAddress}`);
  
  // Update the frontend with the new contract address
  console.log("\nTo use this contract, update BATCH_PROXY_ADDRESS in public/script.js:");
  console.log(`const BATCH_PROXY_ADDRESS = '${contractAddress}';`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
