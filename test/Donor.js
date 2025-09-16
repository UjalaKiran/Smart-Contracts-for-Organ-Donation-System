const Donor = artifacts.require('Donor');
const assert = require('assert');

contract('Donor', (accounts) => {
  const OWNER = accounts[0];
  const DONOR1 = accounts[1];
  const DONOR2 = accounts[2];

  it('should set the deployer as the owner', async () => {
    const instance = await Donor.deployed();
    const owner = await instance.owner();
    assert.equal(owner, OWNER, 'The owner should be the deployer');
  });

  it('should allow registering a donor', async () => {
    const instance = await Donor.deployed();
    const prefs = { heart: true, liver: false, kidneys: true };

    await instance.registerDonor(
      DONOR1,
      "Alice",
      25,
      "O+",
      "Qm123MedicalHash",
      prefs,
      { from: OWNER }
    );

    const donor = await instance.getDonorInfo(DONOR1);

    assert.equal(donor.name, "Alice", "Name should be Alice");
    assert.equal(donor.age.toString(), "25", "Age should be 25");
    assert.equal(donor.bloodType, "O+", "Blood type should be O+");
    assert.equal(donor.preferences.heart, true, "Heart preference should be true");
    assert.equal(donor.status.toString(), "0", "Status should be Active (0)");
  });

  it('should not allow registering the same donor twice', async () => {
    const instance = await Donor.deployed();
    const prefs = { heart: true, liver: true, kidneys: false };

    try {
      await instance.registerDonor(
        DONOR1,
        "Alice",
        25,
        "O+",
        "Qm123MedicalHash",
        prefs,
        { from: OWNER }
      );
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Donor already registered"), "Expected donor already registered error");
    }
  });

  it('should allow only owner to update donor status', async () => {
    const instance = await Donor.deployed();
    await instance.updateDonorStatus(DONOR1, 2, { from: OWNER }); // Matched

    const donor = await instance.getDonorInfo(DONOR1);
    assert.equal(donor.status.toString(), "2", "Donor status should be Matched");
  });

  it('should not allow non-owner to update donor status', async () => {
    const instance = await Donor.deployed();
    try {
      await instance.updateDonorStatus(DONOR1, 1, { from: DONOR1 });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Only owner can call this"), "Expected only owner restriction");
    }
  });

  it('should allow donor to deactivate themselves', async () => {
    const instance = await Donor.deployed();
    await instance.deactivateDonor(DONOR1, { from: DONOR1 });

    const donor = await instance.getDonorInfo(DONOR1);
    assert.equal(donor.status.toString(), "1", "Status should be Deactivated");
  });

  it('should allow donor to update preferences', async () => {
    const instance = await Donor.deployed();
    const newPrefs = { heart: false, liver: true, kidneys: false };

    await instance.updateDonorPreferences(DONOR1, newPrefs, { from: DONOR1 });

    const donor = await instance.getDonorInfo(DONOR1);
    assert.equal(donor.preferences.heart, false, "Heart preference should now be false");
    assert.equal(donor.preferences.kidneys, false, "Kidney preference should now be false");
  });

  it('should not allow other accounts to update preferences', async () => {
    const instance = await Donor.deployed();
    const newPrefs = { heart: true, liver: true, kidneys: true };

    try {
      await instance.updateDonorPreferences(DONOR1, newPrefs, { from: DONOR2 });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Only donor can update preferences"), "Expected only donor restriction");
    }
  });
});