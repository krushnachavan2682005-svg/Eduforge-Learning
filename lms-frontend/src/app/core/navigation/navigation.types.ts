export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string | null;
  action?: string;
  hide?: boolean;
  active?: boolean;
  roles?: string[];
  permissions?: string | string[];
  subItems?: NavItem[];
}

export interface NavConfig {
  title: string;
  logo: string;
  menuItems: NavItem[];
  footerItems: NavItem[];
}
