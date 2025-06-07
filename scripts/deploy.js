
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
  
  // Get the contract artifacts
  const fs = require('fs');
  const batchFactoryArtifact = require('../artifacts/contracts/BatchFactory.sol/BatchFactory.json');
  
  // Write the ABI and bytecode to a file that the frontend can use
  const contractData = {
    address: contractAddress,
    abi: batchFactoryArtifact.abi,
    bytecode: batchFactoryArtifact.bytecode
  };
  
  fs.writeFileSync('./public/BatchFactory.json', JSON.stringify(contractData, null, 2));
  
  console.log("\n✅ Contract artifacts saved to public/BatchFactory.json");
  console.log("\nUsers can now deploy their personal batch contracts through the BatchFactory!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
