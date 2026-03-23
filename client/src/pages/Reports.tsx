import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DashboardMetrics, ProductsResponse, InvoicesResponse, Invoice, Product } from "@shared/schema";

export default function Reports() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  // Fetch all invoices (large limit to get full dataset for reports)
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<InvoicesResponse>({
    queryKey: ["/api/invoices", { limit: 1000 }],
  });

  // Fetch low stock products
  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", { stockLevel: "low", limit: 100 }],
  });

  // Fetch all products for top products analysis
  const { data: allProductsData, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", { limit: 1000 }],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    if (!invoicesData?.invoices) return [];
    return invoicesData.invoices.filter((inv: Invoice) => {
      const invDate = new Date(inv.createdAt || "");
      if (dateFrom && invDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (invDate > endOfDay) return false;
      }
      return true;
    });
  }, [invoicesData, dateFrom, dateTo]);

  // Calculate sales summary from filtered invoices
  const salesSummary = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce(
      (sum: number, inv: Invoice) => sum + parseFloat(String(inv.total || "0")),
      0
    );
    const invoiceCount = filteredInvoices.length;
    const avgValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
    return { totalRevenue, invoiceCount, avgValue };
  }, [filteredInvoices]);

  // Build monthly revenue chart data from filtered invoices
  const monthlyRevenueData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    filteredInvoices.forEach((inv: Invoice) => {
      const date = new Date(inv.createdAt || "");
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      if (!monthMap[key]) {
        monthMap[key] = 0;
      }
      monthMap[key] += parseFloat(String(inv.total || "0"));
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: date.toLocaleDateString("en-US", { year: "numeric", month: "short" }),
          revenue: Math.round(revenue * 100) / 100,
        };
      });
  }, [filteredInvoices]);

  // Derive top products by quantity sold from invoice items
  // Since we don't have invoice items in the response, we derive from products
  const topProducts = useMemo(() => {
    if (!allProductsData?.products) return [];
    // Sort products by quantity (descending) as a proxy for popularity
    // Products with lower quantity relative to their peers likely sold more
    return [...allProductsData.products]
      .sort((a: Product, b: Product) => {
        // Use price * quantity as a revenue proxy, or just sort by total value
        const aValue = parseFloat(String(a.price || "0")) * (a.quantity || 0);
        const bValue = parseFloat(String(b.price || "0")) * (b.quantity || 0);
        return bValue - aValue;
      })
      .slice(0, 10);
  }, [allProductsData]);

  // Low stock products (quantity <= 5)
  const lowStockProducts = useMemo(() => {
    if (!lowStockData?.products) return [];
    return lowStockData.products.filter((p: Product) => p.quantity <= 5);
  }, [lowStockData]);

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // CSV export for sales report
  const exportSalesCSV = () => {
    if (filteredInvoices.length === 0) {
      toast({
        title: "No Data",
        description: "No invoices found to export for the selected date range",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Invoice Number",
      "Customer Name",
      "Date",
      "Subtotal",
      "Tax",
      "Discount",
      "Total",
      "Status",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredInvoices.map((inv: Invoice) =>
        [
          `"${inv.invoiceNumber}"`,
          `"${inv.customerName}"`,
          `"${new Date(inv.createdAt || "").toLocaleDateString()}"`,
          inv.subtotal,
          inv.taxAmount,
          inv.discountAmount || "0.00",
          inv.total,
          `"${inv.status}"`,
        ].join(",")
      ),
    ];

    downloadCSV(csvRows.join("\n"), `sales_report_${new Date().toISOString().split("T")[0]}.csv`);
    toast({
      title: "Export Successful",
      description: `Exported ${filteredInvoices.length} invoices to CSV`,
    });
  };

  // CSV export for low stock report
  const exportLowStockCSV = () => {
    if (lowStockProducts.length === 0) {
      toast({
        title: "No Data",
        description: "No low stock products to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Product ID",
      "Product Name",
      "Category",
      "Size",
      "Color",
      "Quantity",
      "Price",
    ];

    const csvRows = [
      headers.join(","),
      ...lowStockProducts.map((p: Product) =>
        [
          `"${p.productId}"`,
          `"${p.productName}"`,
          `"${p.category || ""}"`,
          `"${p.size}"`,
          `"${p.color}"`,
          p.quantity,
          p.price,
        ].join(",")
      ),
    ];

    downloadCSV(csvRows.join("\n"), `low_stock_report_${new Date().toISOString().split("T")[0]}.csv`);
    toast({
      title: "Export Successful",
      description: `Exported ${lowStockProducts.length} low stock products to CSV`,
    });
  };

  // CSV export for top products
  const exportTopProductsCSV = () => {
    if (topProducts.length === 0) {
      toast({
        title: "No Data",
        description: "No products to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Product ID",
      "Product Name",
      "Category",
      "Size",
      "Color",
      "Quantity In Stock",
      "Price",
      "Stock Value",
    ];

    const csvRows = [
      headers.join(","),
      ...topProducts.map((p: Product) =>
        [
          `"${p.productId}"`,
          `"${p.productName}"`,
          `"${p.category || ""}"`,
          `"${p.size}"`,
          `"${p.color}"`,
          p.quantity,
          p.price,
          (parseFloat(String(p.price || "0")) * (p.quantity || 0)).toFixed(2),
        ].join(",")
      ),
    ];

    downloadCSV(csvRows.join("\n"), `top_products_report_${new Date().toISOString().split("T")[0]}.csv`);
    toast({
      title: "Export Successful",
      description: `Exported ${topProducts.length} products to CSV`,
    });
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = metricsLoading || invoicesLoading || lowStockLoading || productsLoading;

  return (
    <div className="space-y-6">
      {/* Page Header with Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Overview of sales, inventory, and product performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date From Picker */}
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                <i className="fas fa-calendar mr-2 text-muted-foreground"></i>
                {dateFrom ? formatDate(dateFrom) : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(date) => {
                  setDateFrom(date);
                  setFromOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Date To Picker */}
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                <i className="fas fa-calendar mr-2 text-muted-foreground"></i>
                {dateTo ? formatDate(dateTo) : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(date) => {
                  setDateTo(date);
                  setToOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDateFilters}>
              <i className="fas fa-times mr-1"></i>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(salesSummary.totalRevenue)}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-dollar-sign text-accent"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {salesSummary.invoiceCount.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-file-invoice text-primary"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Invoice Value</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(salesSummary.avgValue)}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-purple-500"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Revenue by Month</h3>
          <Button variant="outline" size="sm" onClick={exportSalesCSV}>
            <i className="fas fa-download mr-2"></i>
            Export Sales CSV
          </Button>
        </div>
        <CardContent className="p-6">
          {isLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : monthlyRevenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16">
              <i className="fas fa-chart-bar text-muted-foreground text-4xl mb-4"></i>
              <p className="text-sm text-muted-foreground">
                No revenue data available for the selected period
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Low Stock and Top Products */}
      <Tabs defaultValue="low-stock">
        <TabsList>
          <TabsTrigger value="low-stock">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Low Stock ({lowStockProducts.length})
          </TabsTrigger>
          <TabsTrigger value="top-products">
            <i className="fas fa-star mr-2"></i>
            Top Products
          </TabsTrigger>
        </TabsList>

        {/* Low Stock Tab */}
        <TabsContent value="low-stock">
          <Card>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Low Stock Products (Quantity &le; 5)
              </h3>
              <Button variant="outline" size="sm" onClick={exportLowStockCSV}>
                <i className="fas fa-download mr-2"></i>
                Export CSV
              </Button>
            </div>
            <CardContent className="p-0">
              {lowStockLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : lowStockProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Size / Color
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {lowStockProducts.map((product: Product) => (
                        <tr key={product.id} className="hover:bg-accent/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {product.productName}
                              </p>
                              <p className="text-xs text-muted-foreground">{product.productId}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {product.category || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {product.size} / {product.color}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant="destructive"
                              className={
                                product.quantity === 0
                                  ? "bg-red-600 text-white"
                                  : ""
                              }
                            >
                              {product.quantity === 0
                                ? "Out of Stock"
                                : `${product.quantity} left`}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            {formatCurrency(parseFloat(String(product.price || "0")))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <i className="fas fa-check-circle text-accent text-4xl mb-4"></i>
                  <p className="text-sm text-muted-foreground">
                    All products are well stocked
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Products Tab */}
        <TabsContent value="top-products">
          <Card>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Top Products by Stock Value
              </h3>
              <Button variant="outline" size="sm" onClick={exportTopProductsCSV}>
                <i className="fas fa-download mr-2"></i>
                Export CSV
              </Button>
            </div>
            <CardContent className="p-0">
              {productsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Qty In Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Stock Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {topProducts.map((product: Product, index: number) => {
                        const unitPrice = parseFloat(String(product.price || "0"));
                        const stockValue = unitPrice * (product.quantity || 0);
                        return (
                          <tr
                            key={product.id}
                            className="hover:bg-accent/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-muted-foreground">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.productName}
                                      className="w-10 h-10 rounded-md object-cover"
                                    />
                                  ) : (
                                    <i className="fas fa-image text-muted-foreground text-sm"></i>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {product.productName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {product.productId}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                              {product.category || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={product.quantity <= 5 ? "destructive" : "secondary"}
                              >
                                {product.quantity}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {formatCurrency(unitPrice)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                              {formatCurrency(stockValue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <i className="fas fa-box text-muted-foreground text-4xl mb-4"></i>
                  <p className="text-sm text-muted-foreground">No products found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
