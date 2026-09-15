import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  Car,
  Clock,
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Receipt,
  Search,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Mark } from "@/components/crm/mark";
import { CommandSearch } from "@/components/crm/search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCrm } from "@/lib/crm/workspace";
import { cn } from "@/lib/utils";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Desk", icon: LayoutDashboard, exact: true },
  { to: "/queries", label: "Queries", icon: Inbox },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/customers", label: "Customers", icon: Building2 },
  { to: "/drivers", label: "Drivers", icon: Clock },
  { to: "/vehicles", label: "Vehicles", icon: Car },
  { to: "/vendors", label: "Vendors", icon: Truck },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === "/" || pathname === "/desk" || pathname === "/desk/"
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-[var(--motion-quick)]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const name = useCrm().data.settings.tradingName;
  return (
    <Link to="/" className="flex items-center gap-3 px-5 py-5">
      <Mark />
      <span className="min-w-0">
        <span className="block font-display text-xl leading-none text-primary">{name}</span>
        <span className="mt-1 block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Ground transport CRM
        </span>
      </span>
    </Link>
  );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-card">
      <Brand />
      <div className="flex-1 overflow-y-auto pb-6">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>
      <p className="px-6 pb-5 text-[11px] text-muted-foreground">
        GS Tours · BusBus.nl · HollandCoach.nl
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const title = useMemo(
    () =>
      NAV.find((n) =>
        n.exact ? pathname === "/" || pathname.startsWith("/desk") : pathname.startsWith(n.to),
      )?.label ?? "GS Tours",
    [pathname],
  );
  const { isPending } = useCurrentUserState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-background">
      <aside data-app-chrome className="hidden w-60 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar pathname={pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header
          data-app-chrome
          className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-sm sm:px-6"
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium lg:hidden">{title}</p>
          <Button
            variant="outline"
            className="hidden h-9 min-w-48 justify-start bg-card text-muted-foreground sm:inline-flex lg:min-w-64"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" />
            Search
            <kbd className="ml-auto hidden rounded-sm border border-border px-1.5 text-[10px] lg:inline">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="brand" className="h-9">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/queries">Query</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/bookings">Booking</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/invoices">Invoice</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/customers">Customer</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/drivers">Driver</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/vehicles">Vehicle</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/vendors">Vendor</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/contacts">Contact</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isPending ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-secondary" />
            ) : (
              <UserButton />
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(20rem,88vw)] p-0">
          <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
