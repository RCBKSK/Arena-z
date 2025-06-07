const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("Deploying BatchFactory contract...");

    // Get the ContractFactory
    const BatchFactory = await hre.ethers.getContractFactory("BatchFactory");

    // Deploy the contract
    const batchFactory = await BatchFactory.deploy();

    // Wait for deployment to be mined
    await batchFactory.waitForDeployment();

    const address = await batchFactory.getAddress();
    console.log("BatchFactory deployed to:", address);

    // Save contract data to public directory for frontend use
    const contractData = {
      address: address,
      abi: BatchFactory.interface.formatJson(),
      bytecode: BatchFactory.bytecode
    };

    const publicDir = path.join(__dirname, "..", "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const filePath = path.join(publicDir, "BatchFactory.json");
    fs.writeFileSync(filePath, JSON.stringify(contractData, null, 2));

    console.log("Contract data saved to:", filePath);
    console.log("Deployment completed successfully!");

  } catch (error) {
    console.error("Error deploying BatchFactory contract:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment script failed:", error.message);
    process.exit(1);
  });