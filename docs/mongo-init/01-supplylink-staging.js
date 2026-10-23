const stagingDb = db.getSiblingDB("supplylink_staging");

if (!stagingDb.getUser("supplylink_staging_runner")) {
  stagingDb.createUser({
    user: "supplylink_staging_runner",
    pwd: "staging-runner-local-only",
    roles: [{ role: "readWrite", db: "supplylink_staging" }],
  });
}

if (!stagingDb.getCollection("_supplylink_staging_test_guard").findOne({ _id: "staging-integration-target" })) {
  stagingDb.getCollection("_supplylink_staging_test_guard").insertOne({
    _id: "staging-integration-target",
    environment: "staging",
    database: "supplylink_staging",
    host: "localhost:27017",
    allowTestWrites: true,
  });
}
