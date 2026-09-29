import { NavLink } from "react-router-dom";
import { sidebarLinkClass } from "./sidebarLinkClass";

export function SidebarNavLink({
  to,
  name,
  detail,
}: {
  to: string;
  name: string;
  detail?: string;
}) {
  return (
    <NavLink to={to} className={sidebarLinkClass}>
      <div>
        <div className="name">{name}</div>
        {detail && <div className="role">{detail}</div>}
      </div>
    </NavLink>
  );
}
