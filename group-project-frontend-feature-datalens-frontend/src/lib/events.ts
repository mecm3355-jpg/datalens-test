export const COMPLAINT_DATA_CHANGED_EVENT = "datalens:complaint-data-changed";

export function notifyComplaintDataChanged(): void {
  window.dispatchEvent(new Event(COMPLAINT_DATA_CHANGED_EVENT));
}
