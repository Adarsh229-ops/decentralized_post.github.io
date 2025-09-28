const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const PostManager = await hre.ethers.getContractFactory("PostManager");
  const postManager = await PostManager.deploy();

  console.log("PostManager deployed to:", postManager.target);

  // Save contract info
  const contractInfo = {
    address: postManager.target,
    abi: JSON.parse(postManager.interface.formatJson())
  };

  fs.writeFileSync("./contract-info.json", JSON.stringify(contractInfo, null, 2));
  console.log("Contract info saved to contract-info.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});