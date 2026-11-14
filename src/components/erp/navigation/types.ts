import type { LucideIcon } from 'lucide-react';
import type { ErpTab } from '../ErpLayout';

/** A routeable ERP module. Permissions are resolved by ErpLayout before it reaches a navigation component. */
export interface ErpNavigationItem {
  id: ErpTab;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

export interface ErpNavigationGroup {
  label: string;
  items: ErpNavigationItem[];
}

export interface MobileQuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: 'accent' | 'muted' | 'primary';
}

export interface SalonSelectionOption {
  salonId: string;
  salonName: string;
  roleLabel: string;
  branchName: string | null;
  organizationName: string;
}
