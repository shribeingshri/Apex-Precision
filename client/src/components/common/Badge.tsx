import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
}) => {
  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
    danger: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
    info: 'bg-sky-950/80 text-sky-400 border-sky-800/60',
    purple: 'bg-purple-950/80 text-purple-400 border-purple-800/60',
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
};

export function getStatusBadgeVariant(status: string): BadgeProps['variant'] {
  const s = status.toUpperCase();
  if (['APPROVED', 'COMPLETED', 'PAID', 'DELIVERED', 'CONVERTED', 'ACTIVE'].includes(s)) return 'success';
  if (['IN_PRODUCTION', 'IN_TRANSIT', 'PARTIALLY_PAID', 'PARTIALLY_DELIVERED', 'PROPOSAL_SENT', 'NEGOTIATION', 'IN_PROGRESS'].includes(s)) return 'info';
  if (['PLANNING', 'DRAFT', 'NEW', 'TO_DO', 'UNDER_REVIEW', 'PENDING'].includes(s)) return 'warning';
  if (['REJECTED', 'CANCELLED', 'OVERDUE', 'LOST', 'BLOCKED', 'FAILED', 'HIGH', 'URGENT'].includes(s)) return 'danger';
  if (['QUALITY_INSPECTION', 'READY_FOR_DELIVERY', 'REWORK'].includes(s)) return 'purple';
  return 'default';
}
