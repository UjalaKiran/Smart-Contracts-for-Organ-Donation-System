const Recipient = artifacts.require('Recipient');
const assert = require('assert');

contract('Recipient', (accounts) => {
  const OWNER = accounts[0];
  const RECIPIENT1 = accounts[1];
  const RECIPIENT2 = accounts[2];

  it('should set the deployer as the owner', async () => {
    const instance = await Recipient.deployed();
    const owner = await instance.owner();
    assert.equal(owner, OWNER, 'The owner should be the deployer');
  });

  it('should allow registering a recipient', async () => {
    const instance = await Recipient.deployed();

    const location = { city: "Rawalpindi", country: "Pakistan", additionalInfo: "CEME Hospital" };

    await instance.registerRecipient(
      RECIPIENT1,
      "Bob",
      40,
      "A+",
      "Qm456MedicalHash",
      location,
      { from: OWNER }
    );

    const recipient = await instance.getRecipientInfo(RECIPIENT1);

    assert.equal(recipient.name, "Bob", "Name should be Bob");
    assert.equal(recipient.age.toString(), "40", "Age should be 40");
    assert.equal(recipient.bloodType, "A+", "Blood type should be A+");
    assert.equal(recipient.medicalStatus.toString(), "0", "Default status should be Waiting (0)");
    assert.equal(recipient.location.city, "Rawalpindi", "City should be Rawalpindi");
  });

  it('should not allow registering the same recipient twice', async () => {
    const instance = await Recipient.deployed();
    const location = { city: "Rawalpindi", country: "Pakistan", additionalInfo: "CEME Hospital" };

    try {
      await instance.registerRecipient(
        RECIPIENT1,
        "Bob",
        40,
        "A+",
        "Qm456MedicalHash",
        location,
        { from: OWNER }
      );
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Recipient already registered"), "Expected recipient already registered error");
    }
  });

  it('should allow owner to update recipient medical status', async () => {
    const instance = await Recipient.deployed();

    await instance.updateRecipientMedicalStatus(RECIPIENT1, 2, { from: OWNER }); // Critical

    const recipient = await instance.getRecipientInfo(RECIPIENT1);
    assert.equal(recipient.medicalStatus.toString(), "2", "Status should be Critical");
  });

  it('should not allow non-owner to update medical status', async () => {
    const instance = await Recipient.deployed();

    try {
      await instance.updateRecipientMedicalStatus(RECIPIENT1, 3, { from: RECIPIENT1 });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Only owner can call this"), "Expected only owner restriction");
    }
  });

  it('should allow owner to add recipient to waiting list', async () => {
    const instance = await Recipient.deployed();

    await instance.addToWaitingList(RECIPIENT1, 0, 10, { from: OWNER }); // OrganType.Heart, urgency 10

    const entry = await instance.waitingLists(RECIPIENT1, 0);
    assert.equal(entry.urgencyLevel.toString(), "10", "Urgency level should be 10");
  });

  it('should not allow adding recipient twice to same organ waiting list', async () => {
    const instance = await Recipient.deployed();

    try {
      await instance.addToWaitingList(RECIPIENT1, 0, 5, { from: OWNER }); // Heart again
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Already on waiting list"), "Expected already on waiting list error");
    }
  });

  it('should allow owner to remove recipient from waiting list', async () => {
    const instance = await Recipient.deployed();

    await instance.removeFromWaitingList(RECIPIENT1, 0, { from: OWNER }); // Heart

    const entry = await instance.waitingLists(RECIPIENT1, 0);
    assert.equal(entry.urgencyLevel.toString(), "0", "Recipient should be removed from waiting list");
  });

  it('should allow recipient to update their location', async () => {
    const instance = await Recipient.deployed();

    const newLocation = { city: "Islamabad", country: "Pakistan", additionalInfo: "Shifa Hospital" };
    await instance.updateRecipientLocation(RECIPIENT1, newLocation, { from: RECIPIENT1 });

    const recipient = await instance.getRecipientInfo(RECIPIENT1);
    assert.equal(recipient.location.city, "Islamabad", "City should be updated to Islamabad");
  });

  it('should not allow unauthorized user to update location', async () => {
    const instance = await Recipient.deployed();

    const newLocation = { city: "Lahore", country: "Pakistan", additionalInfo: "General Hospital" };

    try {
      await instance.updateRecipientLocation(RECIPIENT1, newLocation, { from: RECIPIENT2 });
      assert.fail("Expected error but did not get one");
    } catch (error) {
      assert(error.message.includes("Unauthorized"), "Expected Unauthorized error");
    }
  });
});