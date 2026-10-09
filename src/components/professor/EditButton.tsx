/** Small pencil button used to edit a class or an assignment. */
export default function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
