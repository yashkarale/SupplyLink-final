export const DEFAULT_ORDER_WRITE_LIMIT_MB = 350;

export const getDatabaseLogicalBytes = (stats = {}) =>
  Math.max(0, Number(stats.dataSize || 0) + Number(stats.indexSize || 0));

export const getOrderWriteLimitBytes = (value = process.env.MONGODB_ORDER_WRITE_LIMIT_MB) => {
  const limitMb = value === undefined || value === "" ? DEFAULT_ORDER_WRITE_LIMIT_MB : Number(value);
  if (!Number.isFinite(limitMb) || limitMb < 64 || limitMb >= 512) {
    throw new Error("MONGODB_ORDER_WRITE_LIMIT_MB must be between 64 and 511 for an Atlas Free cluster.");
  }
  return Math.floor(limitMb * 1024 * 1024);
};

export const isOrderStorageLimitReached = (stats, limitBytes) =>
  getDatabaseLogicalBytes(stats) >= limitBytes;

export const isDatabaseWriteLimitReached = async (database, limitBytes = getOrderWriteLimitBytes()) => {
  const stats = await database.stats({ scale: 1 });
  return isOrderStorageLimitReached(stats, limitBytes);
};

export const getOrderStorageReport = ({ databaseStats, orderStats = {} }) => ({
  database: {
    documentBytes: Number(databaseStats.dataSize || 0),
    indexBytes: Number(databaseStats.indexSize || 0),
    logicalBytes: getDatabaseLogicalBytes(databaseStats),
  },
  orders: {
    count: Number(orderStats.count || 0),
    documentBytes: Number(orderStats.size || 0),
    indexBytes: Number(orderStats.totalIndexSize || 0),
    averageDocumentBytes: Number(orderStats.avgObjSize || 0),
  },
});
