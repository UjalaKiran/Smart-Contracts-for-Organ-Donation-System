const OrganNFT = artifacts.require("OrganNFT");

module.exports = function (deployer) {
  deployer.deploy(OrganNFT);
};