
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("🔧 Preparing BatchFactory contract artifacts for user deployment...");
    console.log("⚠️  Users will deploy their own BatchFactory instances!");

    // Get the contract artifacts without deploying
    const BatchFactory = await hre.ethers.getContractFactory("BatchFactory");
    
    // Prepare contract data for frontend
    const contractData = {
      abi: JSON.parse(BatchFactory.interface.formatJson()),
      bytecode: BatchFactory.bytecode,
      note: "Each user deploys their own BatchFactory instance"
    };

    // Ensure public directory exists
    const publicDir = path.join(__dirname, "..", "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Save contract artifacts to public directory
    const filePath = path.join(publicDir, "BatchFactory.json");
    fs.writeFileSync(filePath, JSON.stringify(contractData, null, 2));

    console.log("✅ BatchFactory artifacts saved to:", filePath);
    console.log("📝 Users can now deploy their own BatchFactory instances");
    console.log("🎯 Each user gets their personal BatchFactory for batch NFT transfers");

  } catch (error) {
    console.error("Error preparing BatchFactory artifacts:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error.message);
    process.exit(1);
  });
