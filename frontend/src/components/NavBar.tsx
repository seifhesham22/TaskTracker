import { NavLink } from 'react-router';
import { navItems } from '../app/navigation';
import './NavBar.css';

export function NavBar() {
  return (
    <nav className="nav-bar" aria-label="Main">
      <ul className="nav-bar__list">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              id={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                isActive ? 'nav-bar__link nav-bar__link--active' : 'nav-bar__link'
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
