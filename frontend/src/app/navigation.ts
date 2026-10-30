/** Top-level navigation entries, defined once and rendered by NavBar. */
export interface NavItem {
  readonly to: string;
  readonly label: string;
}

export const navItems: readonly NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/about', label: 'About' },
];
