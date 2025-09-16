const Recipient = artifacts.require("Recipient");

module.exports = function (deployer) {
  deployer.deploy(Recipient);
};