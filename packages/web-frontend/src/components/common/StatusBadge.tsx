interface StatusBadgeProps {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${tone}`} role='status' aria-label={`状态: ${label}`}>
      {label}
    </span>
  );
}
