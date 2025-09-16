const Hospital = artifacts.require('Hospital');
const assert = require('assert');
const web3Utils = require('web3-utils');

contract('Hospital', (accounts) => {
  const OWNER = accounts[0];
  const HOSP1 = accounts[1];
  const STAFF1 = accounts[2];
  const OTHER = accounts[3];

  // Helper: struct HospitalData expected as [name, location, licenseId, isVerified]
  const hospData = (name, location, licenseId) => [name, location, licenseId, false];

  it('should set the deployer as the owner', async () => {
    const instance = await Hospital.deployed();
    const owner = await instance.owner();
    assert.equal(owner, OWNER, 'The owner should be the deployer');
  });

  it('should allow owner to register a hospital', async () => {
    const instance = await Hospital.deployed();

    await instance.registerHospital(HOSP1, hospData("CEME Hospital", "Rawalpindi, Pakistan", "LIC-12345"), { from: OWNER });

    const info = await instance.getHospitalInfo(HOSP1);
    assert.equal(info.name, "CEME Hospital", "Name should match");
    assert.equal(info.location, "Rawalpindi, Pakistan", "Location should match");
    assert.equal(info.licenseId, "LIC-12345", "License ID should match");
    assert.equal(info.isVerified, false, "isVerified should be false at registration");
  });

  it('should not allow registering the same hospital twice', async () => {
    const instance = await Hospital.deployed();
    try {
      await instance.registerHospital(HOSP1, hospData("CEME Hospital", "Rawalpindi, Pakistan", "LIC-12345"), { from: OWNER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      // Contract uses custom error AlreadyRegistered -> message should include that substring
      assert(
        error.message.includes("AlreadyRegistered") || error.message.includes("revert"),
        "Expected AlreadyRegistered or revert error"
      );
    }
  });

  it('should not allow non-owner to register a hospital', async () => {
    const instance = await Hospital.deployed();
    const HOSP2 = accounts[4];
    try {
      await instance.registerHospital(HOSP2, hospData("Fake", "Nowhere", "LIC-000"), { from: OTHER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("NotOwner") || error.message.includes("revert"), "Expected NotOwner or revert");
    }
  });

  it('should allow owner to verify hospital credentials', async () => {
    const instance = await Hospital.deployed();

    const cred = web3Utils.asciiToHex("credentials-hash-or-json");
    await instance.verifyHospitalCredentials(HOSP1, web3Utils.hexToBytes(cred), { from: OWNER });

    const info = await instance.getHospitalInfo(HOSP1);
    assert.equal(info.isVerified, true, "Hospital should be verified after calling verifyHospitalCredentials");
  });

  it('should not allow non-owner to verify credentials', async () => {
    const instance = await Hospital.deployed();
    const cred = web3Utils.asciiToHex("somecreds");
    try {
      await instance.verifyHospitalCredentials(HOSP1, web3Utils.hexToBytes(cred), { from: OTHER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("NotOwner") || error.message.includes("revert"), "Expected NotOwner or revert");
    }
  });

  it('should allow hospital (as Admin) to authorize staff', async () => {
    const instance = await Hospital.deployed();

    // HOSP1 was set as Admin for its own hospital during registration; call from HOSP1
    // Role enum: Admin=0, Surgeon=1, Coordinator=2, None=3
    await instance.authorizeHospitalStaff(HOSP1, STAFF1, 2, { from: HOSP1 }); // make STAFF1 Coordinator

    const role = await instance.getStaffRole(HOSP1, STAFF1);
    assert.equal(role.toString(), "2", "Role should be Coordinator (2)");
  });

  it('should not allow unauthorized user to authorize staff', async () => {
    const instance = await Hospital.deployed();
    const SOME = accounts[5];
    try {
      // OTHER (not owner and not admin) tries to authorize
      await instance.authorizeHospitalStaff(HOSP1, SOME, 1, { from: OTHER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      // Expect Unauthorized or revert
      assert(error.message.includes("Unauthorized") || error.message.includes("revert"), "Expected Unauthorized or revert");
    }
  });

  it('should allow authorized staff (Coordinator) to update capacity', async () => {
    const instance = await Hospital.deployed();

    // STAFF1 is Coordinator (role 2) and should be allowed to update capacity
    // OrganType enum: Heart=0, Liver=1, Kidneys=2
    await instance.updateHospitalCapacity(HOSP1, 0, 5, { from: STAFF1 }); // Heart capacity = 5

    const cap = await instance.getHospitalCapacity(HOSP1, 0);
    assert.equal(cap.toString(), "5", "Heart capacity should be 5");
  });

  it('should allow owner to update capacity as well', async () => {
    const instance = await Hospital.deployed();

    await instance.updateHospitalCapacity(HOSP1, 1, 2, { from: OWNER }); // Liver capacity = 2
    const cap = await instance.getHospitalCapacity(HOSP1, 1);
    assert.equal(cap.toString(), "2", "Liver capacity should be 2");
  });

  it('should not allow unauthorized address to update capacity', async () => {
    const instance = await Hospital.deployed();
    try {
      // OTHER has not been authorized, should revert
      await instance.updateHospitalCapacity(HOSP1, 2, 10, { from: OTHER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Unauthorized") || error.message.includes("revert"), "Expected Unauthorized or revert");
    }
  });

  it('should return NotRegistered for getHospitalInfo of unknown address', async () => {
    const instance = await Hospital.deployed();
    const UNREG = accounts[6];
    try {
      await instance.getHospitalInfo(UNREG);
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("NotRegistered") || error.message.includes("revert"), "Expected NotRegistered or revert");
    }
  });

  it('should allow owner to update hospital core info', async () => {
    const instance = await Hospital.deployed();

    await instance.updateHospitalCoreInfo(HOSP1, "CEME Updated", "Islamabad, Pakistan", "LIC-99999", { from: OWNER });
    const info = await instance.getHospitalInfo(HOSP1);
    assert.equal(info.name, "CEME Updated", "Name should be updated");
    assert.equal(info.location, "Islamabad, Pakistan", "Location should be updated");
    assert.equal(info.licenseId, "LIC-99999", "LicenseId should be updated");
  });

  it('should not allow non-owner to update core info', async () => {
    const instance = await Hospital.deployed();
    try {
      await instance.updateHospitalCoreInfo(HOSP1, "Bad", "Nowhere", "LIC-0", { from: OTHER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("NotOwner") || error.message.includes("revert"), "Expected NotOwner or revert");
    }
  });

  it('should allow owner to transfer ownership and restrict privileged actions afterwards', async () => {
    const instance = await Hospital.deployed();

    // Transfer ownership to OTHER
    await instance.transferOwnership(OTHER, { from: OWNER });
    const newOwner = await instance.owner();
    assert.equal(newOwner, OTHER, "Ownership should be transferred to OTHER");

    // Previous owner should no longer be able to perform owner-only action (verifyHospitalCredentials)
    const cred = web3Utils.asciiToHex("after-transfer");
    try {
      await instance.verifyHospitalCredentials(HOSP1, web3Utils.hexToBytes(cred), { from: OWNER });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("NotOwner") || error.message.includes("revert"), "Expected NotOwner or revert after transfer");
    }

    // New owner (OTHER) can perform owner-only action
    await instance.verifyHospitalCredentials(HOSP1, web3Utils.hexToBytes(cred), { from: OTHER });
    const info = await instance.getHospitalInfo(HOSP1);
    assert.equal(info.isVerified, true, "Hospital should be verified by new owner");
  });

  it('cleanup: set owner back to original deployer (if needed)', async () => {
    const instance = await Hospital.deployed();
    // if tests depend on owner being OWNER later, set it back
    const currentOwner = await instance.owner();
    if (currentOwner !== OWNER) {
      await instance.transferOwnership(OWNER, { from: currentOwner });
      const finalOwner = await instance.owner();
      assert.equal(finalOwner, OWNER, "Owner restored to original deployer");
    }
  });
});
