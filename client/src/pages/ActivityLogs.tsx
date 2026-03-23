import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLogs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    module: "",
    userId: "",
    startDate: "",
    endDate: ""
  });

  const { data: logsData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/activity-logs", { page, limit: 50, ...filters }],
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) === 1 ? '' : 's'} ago`;
  };

  const getActivityIcon = (module: string) => {
    const icons = {
      Products: 'fas fa-box text-accent',
      Invoices: 'fas fa-file-invoice text-primary',
      Users: 'fas fa-users text-purple-500',
      Inventory: 'fas fa-exclamation-triangle text-destructive',
      System: 'fas fa-cog text-muted-foreground',
    };
    return icons[module as keyof typeof icons] || 'fas fa-circle text-muted-foreground';
  };

  const getModuleBadge = (module: string) => {
    const colors = {
      Products: "bg-accent/10 text-accent",
      Invoices: "bg-primary/10 text-primary",
      Users: "bg-purple-100 text-purple-600",
      Inventory: "bg-destructive/10 text-destructive",
      System: "bg-muted text-muted-foreground",
    };
    return <Badge className={colors[module as keyof typeof colors] || colors.System}>{module}</Badge>;
  };

  const exportLogs = () => {
    const logs = logsData?.logs;
    if (!logs || logs.length === 0) {
      return;
    }

    const headers = ["Date", "Action", "Module", "User", "IP Address"];
    const csvRows = [
      headers.join(","),
      ...logs.map((log: any) => [
        `"${new Date(log.createdAt).toLocaleString()}"`,
        `"${(log.action || "").replace(/"/g, '""')}"`,
        `"${log.module}"`,
        `"${log.user?.firstName && log.user?.lastName ? `${log.user.firstName} ${log.user.lastName}` : log.user?.email || 'System'}"`,
        `"${log.ipAddress || ''}"`,
      ].join(","))
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_logs_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-exclamation-circle text-destructive text-4xl mb-4"></i>
        <p className="text-sm text-muted-foreground">Failed to load activity logs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Log Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={filters.module} onValueChange={(value) => handleFilterChange("module", value)}>
            <SelectTrigger className="w-40" data-testid="select-module">
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="Products">Product Activities</SelectItem>
              <SelectItem value="Invoices">Invoice Activities</SelectItem>
              <SelectItem value="Users">User Activities</SelectItem>
              <SelectItem value="Inventory">Inventory Activities</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="w-40"
            placeholder="Start Date"
            data-testid="input-start-date"
          />
          
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="w-40"
            placeholder="End Date"
            data-testid="input-end-date"
          />
        </div>

        <Button 
          variant="outline"
          onClick={exportLogs}
          data-testid="button-export-logs"
        >
          <i className="fas fa-download mr-2"></i>
          Export Logs
        </Button>
      </div>

      {/* Activity Timeline */}
      <Card>
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Activity Timeline</h3>
        </div>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : logsData?.logs?.length ? (
            <div className="space-y-6">
              {logsData.logs.map((log: any) => (
                <div key={log.id} className="flex items-start space-x-4" data-testid={`activity-log-${log.id}`}>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" 
                         style={{
                           backgroundColor: log.module === 'Products' ? 'hsl(158 64% 52% / 0.1)' :
                                          log.module === 'Invoices' ? 'hsl(221 83% 53% / 0.1)' :
                                          log.module === 'Users' ? 'hsl(267 57% 50% / 0.1)' :
                                          'hsl(215 16% 47% / 0.1)'
                         }}>
                      <i className={getActivityIcon(log.module).replace('text-accent', 'text-accent').replace('text-primary', 'text-primary').replace('text-purple-500', 'text-purple-500') + ' w-4 h-4'}></i>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          {log.action}
                        </p>
                        <div className="mt-1 flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{formatTimeAgo(log.createdAt)}</span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                          {getModuleBadge(log.module)}
                        </div>
                        {log.user && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {log.user.firstName && log.user.lastName ? 
                                `${log.user.firstName} ${log.user.lastName}` : 
                                log.user.email}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                        <i className="fas fa-ellipsis-h w-4 h-4"></i>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <i className="fas fa-history text-muted-foreground text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">No activity found</h3>
              <p className="text-muted-foreground">System activity will appear here as users interact with the application</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {logsData?.total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, logsData.total)} of {logsData.total} results
          </p>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-previous-page"
            >
              Previous
            </Button>
            <span className="px-3 py-2 text-sm">{page}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page * 50 >= logsData.total}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
