const Donor = artifacts.require("Donor");

module.exports = function (deployer) {
  deployer.deploy(Donor);
};