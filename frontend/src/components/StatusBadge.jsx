const COLOR_MAP = {
  draft: "badge badge-draft",
  submitted: "badge badge-submitted",
  approved: "badge badge-approved",
  rejected: "badge badge-rejected",
};

function StatusBadge({ status }) {
  return <span className={COLOR_MAP[status] || "badge"}>{status}</span>;
}

export default StatusBadge;
