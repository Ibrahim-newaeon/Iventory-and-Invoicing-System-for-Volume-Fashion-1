import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

export default function Invoices() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
    customerName: ""
  });

  const { data: invoicesData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/invoices", { page, limit: 20, ...filters }],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/invoices/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/email`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice sent via email successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/whatsapp`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice sent via WhatsApp successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send WhatsApp message",
        variant: "destructive",
      });
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/invoices/${id}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel invoice",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === 'Processed') {
      return <Badge className="bg-accent/10 text-accent">Processed</Badge>;
    }
    if (status === 'Cancelled') {
      return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
  };

  const canProcessInvoice = () => {
    return ['Admin', 'Manager'].includes(user?.role || '');
  };

  const downloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-exclamation-circle text-destructive text-4xl mb-4"></i>
        <p className="text-sm text-muted-foreground">Failed to load invoices</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
          <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Processed">Processed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="w-full sm:w-40"
            placeholder="Date from"
            data-testid="input-start-date"
          />
          
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="w-full sm:w-40"
            placeholder="Date to"
            data-testid="input-end-date"
          />
          
          <Input
            type="text"
            value={filters.customerName}
            onChange={(e) => handleFilterChange("customerName", e.target.value)}
            className="w-full sm:w-48"
            placeholder="Search by customer name"
            data-testid="input-customer-name"
          />
        </div>

        <Link href="/create-invoice">
          <Button data-testid="button-create-invoice">
            <i className="fas fa-plus mr-2"></i>
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : invoicesData?.invoices?.length ? (
                  invoicesData.invoices.map((invoice: any) => (
                    <tr 
                      key={invoice.id} 
                      className="hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => window.location.href = `/invoices/${invoice.id}`}
                      data-testid={`row-invoice-${invoice.id}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {invoice.customerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <Link href={`/invoices/${invoice.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-view-${invoice.id}`}
                          >
                            <i className="fas fa-eye w-4 h-4"></i>
                          </Button>
                        </Link>
                        
                        {invoice.status === 'Processed' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); downloadPDF(invoice.id, invoice.invoiceNumber); }}
                              data-testid={`button-download-${invoice.id}`}
                            >
                              <i className="fas fa-download w-4 h-4"></i>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); sendEmailMutation.mutate(invoice.id); }}
                              disabled={sendEmailMutation.isPending}
                              title="Send via Email"
                              data-testid={`button-email-${invoice.id}`}
                            >
                              <i className="fas fa-envelope w-4 h-4"></i>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); sendWhatsAppMutation.mutate(invoice.id); }}
                              disabled={sendWhatsAppMutation.isPending}
                              title="Send via WhatsApp"
                              data-testid={`button-whatsapp-${invoice.id}`}
                            >
                              <i className="fab fa-whatsapp w-4 h-4"></i>
                            </Button>
                          </>
                        ) : invoice.status === 'Pending' && canProcessInvoice() ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: invoice.id, status: 'Processed' }); }}
                              disabled={updateStatusMutation.isPending}
                              title="Mark as Processed"
                              data-testid={`button-process-${invoice.id}`}
                            >
                              <i className="fas fa-check w-4 h-4"></i>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); if (confirm('Are you sure you want to cancel this invoice?')) cancelInvoiceMutation.mutate(invoice.id); }}
                              disabled={cancelInvoiceMutation.isPending}
                              title="Cancel Invoice"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-cancel-${invoice.id}`}
                            >
                              <i className="fas fa-ban w-4 h-4"></i>
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="space-y-4">
                        <i className="fas fa-file-invoice text-muted-foreground text-4xl"></i>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">No invoices found</h3>
                          <p className="text-muted-foreground mb-6">Create your first invoice to get started</p>
                          <Link href="/create-invoice">
                            <Button data-testid="button-create-first-invoice">
                              <i className="fas fa-plus mr-2"></i>
                              Create Invoice
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {invoicesData?.total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, invoicesData.total)} of {invoicesData.total} results
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
              disabled={page * 20 >= invoicesData.total}
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
