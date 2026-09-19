export const REPORT_STATUSES = ['DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED_FOR_CORRECTION','RESUBMITTED','VALIDATED','INCLUDED_IN_SITREP','ARCHIVED']
export const SITREP_STATUSES = ['DRAFT','FINALIZED','DISTRIBUTED','ARCHIVED']
export const ROLE_LABELS = { lgu:'LGU User', pswdo:'PSWDO / Provincial Consolidator', viewer:'DSWD / PDRRMO Viewer', admin:'System Administrator' }
export const STATUS_META = {
  DRAFT:['Draft','blue'], SUBMITTED:['Submitted','yellow'], UNDER_REVIEW:['Under Review','yellow'],
  RETURNED_FOR_CORRECTION:['Returned','orange'], RESUBMITTED:['Resubmitted','yellow'], VALIDATED:['Validated','green'],
  INCLUDED_IN_SITREP:['Included in SitRep','green'], ARCHIVED:['Archived','gray'], NO_REPORT:['No Report','gray'], ERROR:['Critical discrepancy','red']
}
