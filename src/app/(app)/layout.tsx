import { Sidebar, TabBar, TopBar } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="content">
        <TopBar />
        <main className="page">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
