import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeftRight, CalendarRange, ChartLine, LayoutDashboard, LogOut, Settings, Wallet } from "lucide-react";
import { signOut } from "@/api";

const ITEMS = [
  { href: "/", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { href: "/movimenti", label: "Movimenti", short: "Movimenti", icon: ArrowLeftRight },
  { href: "/spese-prevedibili", label: "Spese prevedibili", short: "Prevedibili", icon: CalendarRange },
  { href: "/lungo-termine", label: "Lungo termine", short: "Lungo termine", icon: ChartLine },
];
const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/movimenti": "Movimenti",
  "/spese-prevedibili": "Spese prevedibili",
  "/lungo-termine": "Lungo termine",
  "/impostazioni": "Impostazioni",
};

const isOn = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TabBar() {
  const path = useLocation().pathname;
  return (
    <nav className="tabbar" aria-label="Navigazione">
      {ITEMS.map(({ href, short, icon: I }) => (
        <Link key={href} to={href} className={isOn(path, href) ? "on" : ""}>
          <I size={24} strokeWidth={1.8} />
          {short}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const path = useLocation().pathname;
  return (
    <aside className="sidebar" aria-label="Navigazione">
      <div className="brand">
        <span className="ico" style={{ background: "var(--accent)", color: "var(--on-accent)" }}><Wallet size={18} /></span>
        Finanza
      </div>
      {ITEMS.map(({ href, label, icon: I }) => (
        <Link key={href} to={href} className={isOn(path, href) ? "on" : ""}>
          <I size={20} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
      <div className="spacer" />
      <Link to="/impostazioni" className={isOn(path, "/impostazioni") ? "on" : ""}>
        <Settings size={20} strokeWidth={1.8} />
        Impostazioni
      </Link>
      <LogoutButton className="link" style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 15, fontWeight: 500, gap: 12 }} />
    </aside>
  );
}

export function TopBar() {
  const path = useLocation().pathname;
  const title = TITLES[path] ?? "Finanza";
  return (
    <header className="topbar">
      <h1>{title}</h1>
      {path !== "/impostazioni" && (
        <Link to="/impostazioni" className="icon-btn" aria-label="Impostazioni">
          <Settings size={20} strokeWidth={1.8} />
        </Link>
      )}
    </header>
  );
}

export function LogoutButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={async () => {
        await signOut();
        navigate("/login", { replace: true });
      }}
    >
      <LogOut size={style ? 20 : 16} strokeWidth={1.8} /> Esci
    </button>
  );
}
