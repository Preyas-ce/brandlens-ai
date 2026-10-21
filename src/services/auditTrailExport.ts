export interface AuditTrailRecord {
  events?: AuditTrailRecord[];
  recordOrigin?: 'live' | 'seeded_example';
}

const tagRecordOrigin = <T extends AuditTrailRecord>(
  record: T,
  recordOrigin: 'live' | 'seeded_example',
): T => ({
  ...record,
  recordOrigin,
  events: record.events?.map((event) => tagRecordOrigin(event, recordOrigin)),
});

export const createAuditTrailExport = <T extends AuditTrailRecord>(
  liveRecords: T[],
  seededExampleRecords: T[],
) => ({
  liveAuditRecords: liveRecords.map((record) => tagRecordOrigin(record, 'live')),
  seededExampleRecords: seededExampleRecords.map((record) => tagRecordOrigin(record, 'seeded_example')),
});
