
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SimpleBatchTransfer contract...");

  // Get the contract factory
  const SimpleBatchTransfer = await ethers.getContractFactory("SimpleBatchTransfer");

  // Deploy the contract
  const batchTransfer = await SimpleBatchTransfer.deploy();
  await batchTransfer.waitForDeployment();

  const contractAddress = await batchTransfer.getAddress();
  
  console.log("SimpleBatchTransfer deployed to:", contractAddress);
  console.log("Explorer URL:", `https://explorer.arena-z.gg/address/${contractAddress}`);
  
  console.log("\nTo use this contract, update your batch contract address in the frontend:");
  console.log(`Your personal batch contract: ${contractAddress}`);
  
  console.log("\nThis contract is owned by:", await batchTransfer.owner());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
