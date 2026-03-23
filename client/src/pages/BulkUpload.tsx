import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function BulkUpload() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const bulkUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/products/bulk-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload");
      }
      
      return response.json();
    },
    onSuccess: (results) => {
      setUploadResults(results);
      setIsProcessing(false);
      toast({
        title: "Upload Complete",
        description: `${results.imported} products imported, ${results.duplicates.length} duplicates skipped`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error) => {
      setIsProcessing(false);
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
        description: "Failed to upload products",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResults(null);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const product: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header.toLowerCase()) {
          case 'productid':
          case 'product_id':
            product.productId = value;
            break;
          case 'productname':
          case 'product_name':
            product.productName = value;
            break;
          case 'color':
            product.color = value;
            break;
          case 'price':
            product.price = parseFloat(value) || 0;
            break;
          case 'quantity':
            product.quantity = parseInt(value) || 0;
            break;
          case 'size':
            product.size = value;
            break;
          case 'category':
            product.category = value;
            break;
          case 'description':
            product.description = value;
            break;
        }
      });

      if (product.productId && product.productName) {
        products.push(product);
      }
    }

    return products;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Error",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await bulkUploadMutation.mutateAsync(formData);
      setUploadProgress(100);
      clearInterval(interval);

    } catch (error) {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `productId,productName,color,price,quantity,size,category,description
F00001,Sample Dress,Red,59.99,10,M,Dresses,A beautiful red dress
F00002,Sample Top,Blue,29.99,15,L,Tops,Comfortable blue top`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Bulk Upload Products</h3>
          
          {/* Upload Instructions */}
          <Alert className="mb-6">
            <i className="fas fa-info-circle"></i>
            <AlertDescription>
              <h4 className="font-medium mb-2">Upload Instructions</h4>
              <ul className="space-y-1 text-sm">
                <li>• Upload CSV files with product data</li>
                <li>• Required columns: productId, productName, color, price, quantity, size</li>
                <li>• Optional columns: category, description</li>
                <li>• Duplicate product IDs will be skipped</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* File Upload Area */}
          {!isProcessing && !uploadResults && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-6">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileSelect}
                className="hidden" 
                id="bulk-upload-file"
                data-testid="input-file-upload"
              />
              <label htmlFor="bulk-upload-file" className="cursor-pointer">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-file-csv text-primary text-2xl"></i>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {selectedFile ? selectedFile.name : "Drop your CSV file here"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFile ? "File selected - click upload to proceed" : "or click to browse files"}
                </p>
              </label>
            </div>
          )}

          {/* Sample Template */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-medium text-foreground">Need a template?</h4>
              <p className="text-sm text-muted-foreground">Download our sample CSV file to get started</p>
            </div>
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              data-testid="button-download-template"
            >
              <i className="fas fa-download mr-2"></i>
              Download Template
            </Button>
          </div>

          {/* Upload Progress */}
          {isProcessing && (
            <div className="bg-muted rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Uploading products...</span>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                Processing {selectedFile?.name}...
              </p>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults && (
            <div className="space-y-4 mb-6">
              <Alert>
                <i className="fas fa-check-circle text-accent"></i>
                <AlertDescription>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Upload completed successfully!</span>
                  </div>
                  <p className="mt-1">
                    {uploadResults.imported} products imported
                    {uploadResults.duplicates.length > 0 && `, ${uploadResults.duplicates.length} duplicates skipped`}
                  </p>
                </AlertDescription>
              </Alert>

              {/* Error Details */}
              {uploadResults.duplicates.length > 0 && (
                <Alert variant="destructive">
                  <i className="fas fa-exclamation-triangle"></i>
                  <AlertDescription>
                    <h5 className="font-medium mb-2">Duplicate Product IDs Skipped</h5>
                    <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                      {uploadResults.duplicates.map((productId: string, index: number) => (
                        <p key={index}>Product ID: {productId}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <Button 
              variant="outline"
              onClick={() => navigate("/products")}
              data-testid="button-back-to-products"
            >
              Back to Products
            </Button>
            
            {!isProcessing && !uploadResults && (
              <Button 
                onClick={handleUpload}
                disabled={!selectedFile || bulkUploadMutation.isPending}
                data-testid="button-start-upload"
              >
                <i className="fas fa-upload mr-2"></i>
                Start Upload
              </Button>
            )}
            
            {uploadResults && (
              <Button 
                onClick={() => {
                  setSelectedFile(null);
                  setUploadResults(null);
                  setUploadProgress(0);
                }}
                data-testid="button-upload-more"
              >
                <i className="fas fa-plus mr-2"></i>
                Upload More
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
