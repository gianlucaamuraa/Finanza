"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, CalendarRange, ChartLine, LayoutDashboard, LogOut, Settings, Wallet } from "lucide-react";
import { logout } from "@/app/actions";

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
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Navigazione">
      {ITEMS.map(({ href, short, icon: I }) => (
        <Link key={href} href={href} className={isOn(path, href) ? "on" : ""}>
          <I size={24} strokeWidth={1.8} />
          {short}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar" aria-label="Navigazione">
      <div className="brand">
        <span className="ico" style={{ background: "var(--accent)", color: "#fff" }}><Wallet size={18} /></span>
        Finanza
      </div>
      {ITEMS.map(({ href, label, icon: I }) => (
        <Link key={href} href={href} className={isOn(path, href) ? "on" : ""}>
          <I size={20} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
      <div className="spacer" />
      <Link href="/impostazioni" className={isOn(path, "/impostazioni") ? "on" : ""}>
        <Settings size={20} strokeWidth={1.8} />
        Impostazioni
      </Link>
      <form action={logout}>
        <button type="submit" className="link" style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 15, fontWeight: 500, gap: 12 }}>
          <LogOut size={20} strokeWidth={1.8} /> Esci
        </button>
      </form>
    </aside>
  );
}

export function TopBar() {
  const path = usePathname();
  const title = TITLES[path] ?? "Finanza";
  return (
    <header className="topbar">
      <h1>{title}</h1>
      {path !== "/impostazioni" && (
        <Link href="/impostazioni" className="icon-btn" aria-label="Impostazioni">
          <Settings size={20} strokeWidth={1.8} />
        </Link>
      )}
    </header>
  );
}
