import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            data-testid="button-mobile-menu"
          >
            <i className="fas fa-bars w-5 h-5"></i>
          </Button>
          <h2 className="text-lg lg:text-xl font-semibold text-foreground">{title}</h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search Bar - Hidden on mobile */}
          <div className="relative hidden md:block">
            <Input
              type="text"
              placeholder="Search products..."
              className="w-40 lg:w-64 pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              data-testid="input-search"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"></i>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={isDark ? "ghost" : "default"}
              size="sm"
              onClick={() => {
                if (isDark) {
                  setIsDark(false);
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('theme', 'light');
                }
              }}
              className={`px-3 py-2 rounded-md transition-all duration-200 ${
                !isDark
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="button-light-mode"
            >
              <i className="fas fa-sun w-4 h-4 mr-2"></i>
              <span className="text-sm font-medium">Light</span>
            </Button>

            <Button
              variant={isDark ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                if (!isDark) {
                  setIsDark(true);
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
                }
              }}
              className={`px-3 py-2 rounded-md transition-all duration-200 ml-1 ${
                isDark
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="button-dark-mode"
            >
              <i className="fas fa-moon w-4 h-4 mr-2"></i>
              <span className="text-sm font-medium">Dark</span>
            </Button>
          </div>

          {/* Logout Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await fetch("/api/auth/logout", {
                  method: "POST",
                  credentials: "include"
                });
                if (response.ok) {
                  window.location.href = "/";
                }
              } catch {
                window.location.href = "/";
              }
            }}
            className="px-4 py-2 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt w-4 h-4 mr-2"></i>
            <span className="text-sm font-medium">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
