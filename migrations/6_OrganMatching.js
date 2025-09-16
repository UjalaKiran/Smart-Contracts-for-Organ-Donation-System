const OrganMatching = artifacts.require("OrganMatching");
const OrganNFT = artifacts.require("OrganNFT");
const Recipient = artifacts.require("Recipient");
const Donor = artifacts.require("Donor");
const Hospital = artifacts.require("Hospital");
const OrganQuality = artifacts.require("OrganQuality");

module.exports = async function (deployer) {
  try {
    // Make sure all dependent contracts are deployed first
    await deployer.deploy(OrganNFT);
    await deployer.deploy(Recipient);
    await deployer.deploy(Donor);
    await deployer.deploy(Hospital);
    
    // Get deployed instances
    const organNFTInstance = await OrganNFT.deployed();
    const recipientInstance = await Recipient.deployed();
    const donorInstance = await Donor.deployed();
    const hospitalInstance = await Hospital.deployed();
    
    // Deploy OrganQuality if not already deployed
    let organQualityInstance;
    try {
      organQualityInstance = await OrganQuality.deployed();
    } catch (error) {
      await deployer.deploy(OrganQuality, organNFTInstance.address);
      organQualityInstance = await OrganQuality.deployed();
    }

    // Deploy OrganMatching contract with all required addresses
    await deployer.deploy(
      OrganMatching,
      organNFTInstance.address,
      recipientInstance.address,
      donorInstance.address,
      hospitalInstance.address,
      organQualityInstance.address
    );

    const organMatchingInstance = await OrganMatching.deployed();

    console.log("OrganMatching deployed successfully!");
    console.log("OrganMatching address:", organMatchingInstance.address);
    console.log("Connected contracts:");
    console.log("- OrganNFT:", organNFTInstance.address);
    console.log("- Recipient:", recipientInstance.address);
    console.log("- Donor:", donorInstance.address);
    console.log("- Hospital:", hospitalInstance.address);
    console.log("- OrganQuality:", organQualityInstance.address);

    // Optional: Set up initial configuration
    try {
      // Update OrganNFT contract to recognize OrganMatching as authorized
      const organNFTOwner = await organNFTInstance.owner();
      console.log("OrganNFT owner:", organNFTOwner);
      
      // Note: You may need to manually call setContractAddresses on OrganNFT
      // to include the OrganMatching contract address if needed
      
    } catch (error) {
      console.log("Note: Additional manual configuration may be required");
      console.log("Error:", error.message);
    }

  } catch (error) {
    console.error("Error deploying OrganMatching:", error);
    throw error;
  }
};