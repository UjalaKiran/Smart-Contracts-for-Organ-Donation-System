const OrganQuality = artifacts.require("OrganQuality");
const OrganNFT = artifacts.require("OrganNFT");

module.exports = async function (deployer) {
  // Make sure OrganNFT is already deployed
  await deployer.deploy(OrganNFT);
  const organNFTInstance = await OrganNFT.deployed();

  // Deploy OrganQuality with OrganNFT's address
  await deployer.deploy(OrganQuality, organNFTInstance.address);
};