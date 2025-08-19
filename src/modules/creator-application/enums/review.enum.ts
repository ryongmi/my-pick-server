export enum ReviewStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUIRED = 'revision_required',
}

export enum ReviewActionType {
  STATUS_CHANGE = 'status_change',
  COMMENT_ADDED = 'comment_added',
  REQUIREMENT_ADDED = 'requirement_added',
  DOCUMENT_REVIEWED = 'document_reviewed',
}