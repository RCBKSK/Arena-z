
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying BatchFactory contract...");

  // Get the contract factory
  const BatchFactory = await ethers.getContractFactory("BatchFactory");

  // Deploy the contract
  const batchFactory = await BatchFactory.deploy();
  await batchFactory.waitForDeployment();

  const contractAddress = await batchFactory.getAddress();
  
  console.log("BatchFactory deployed to:", contractAddress);
  console.log("Explorer URL:", `https://explorer.arena-z.gg/address/${contractAddress}`);
  
  // Update the frontend with the new contract address
  console.log("\nTo use this contract, update BATCH_FACTORY_ADDRESS in public/script.js:");
  console.log(`const BATCH_FACTORY_ADDRESS = '${contractAddress}';`);
  
  console.log("\nUsers can now deploy their personal batch contracts through the BatchFactory!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
