import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const addProductSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  color: z.string().min(1, "Color is required"),
  size: z.string().min(1, "Size is required"),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  price: z.number().min(0, "Price must be 0 or greater"),
  manufacturer: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

type AddProductForm = z.infer<typeof addProductSchema>;

export default function AddProduct() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");

  const form = useForm<AddProductForm>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      productId: "",
      productName: "",
      color: "",
      size: "",
      quantity: 0,
      price: 0,
      manufacturer: "",
      category: "",
      description: "",
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: Omit<AddProductForm, 'price'> & { price: string; imageUrl?: string }) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: (product) => {
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      navigate("/products");
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
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateProductImageMutation = useMutation({
    mutationFn: async ({ productId, imageUrl }: { productId: string; imageUrl: string }) => {
      const response = await apiRequest("PUT", `/api/products/${productId}/image`, { imageUrl });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product image and QR code generated successfully",
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
        title: "Warning",
        description: "Product created but failed to update image",
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10485760) {
      toast({ title: "Error", description: "Image must be under 10MB", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    setUploadedImageUrl(url);
    toast({ title: "Success", description: "Image selected" });
  };

  const onSubmit = async (data: AddProductForm) => {
    // Ensure image is uploaded before submission
    if (!uploadedImageUrl) {
      toast({
        title: "Image Required",
        description: "Please upload a product image before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      const productData = {
        ...data,
        price: data.price.toString(), // Convert price to string for decimal field
        quantity: Math.floor(data.quantity), // Ensure quantity is integer
        imageUrl: uploadedImageUrl,
      };

      const product = await createProductMutation.mutateAsync(productData);

      // If image was uploaded, update the product with the image URL and generate QR code
      if (uploadedImageUrl && product.id) {
        updateProductImageMutation.mutate({
          productId: product.id,
          imageUrl: uploadedImageUrl,
        });
      }
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-xl border-0 bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <i className="fas fa-plus text-primary text-2xl"></i>
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-2">Add New Product</h3>
            <p className="text-muted-foreground text-lg">Create a new product for your fashion inventory</p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Product Basic Info */}
              <div className="bg-background/50 rounded-xl border p-6">
                <h4 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-tag text-primary text-sm"></i>
                  </div>
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-barcode text-muted-foreground"></i>
                        Product ID
                      </FormLabel>
                      <FormControl>
                        <div className="flex gap-3">
                          <Input 
                            placeholder="F00XXX" 
                            {...field}
                            data-testid="input-product-id"
                            className="flex-1 h-12 text-base"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const randomId = `PROD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                              field.onChange(randomId);
                            }}
                            data-testid="button-generate-product-id"
                            className="h-12 px-6 bg-primary/5 hover:bg-primary/10 border-primary/20"
                          >
                            <i className="fas fa-dice mr-2"></i>
                            Generate
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-tshirt text-muted-foreground"></i>
                        Product Name
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter product name" 
                          {...field}
                          data-testid="input-product-name"
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>

              {/* Product Details */}
              <div className="bg-background/50 rounded-xl border p-6">
                <h4 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-palette text-primary text-sm"></i>
                  </div>
                  Product Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-palette text-muted-foreground"></i>
                        Color
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Navy Blue" 
                          {...field}
                          data-testid="input-color"
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-ruler text-muted-foreground"></i>
                        Size
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-size" className="h-12 text-base">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="XS">XS</SelectItem>
                          <SelectItem value="S">S</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="XL">XL</SelectItem>
                          <SelectItem value="XXL">XXL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-boxes text-muted-foreground"></i>
                        Quantity
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-quantity"
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>

              {/* Pricing & Category */}
              <div className="bg-background/50 rounded-xl border p-6">
                <h4 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-dollar-sign text-primary text-sm"></i>
                  </div>
                  Pricing & Category
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-dollar-sign text-muted-foreground"></i>
                        Price ($)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-price"
                            className="h-12 text-base pl-8"
                          />
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-muted-foreground text-base">$</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-industry text-muted-foreground"></i>
                        Manufacturer (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Nike, Adidas, Zara" 
                          {...field}
                          data-testid="input-manufacturer"
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        <i className="fas fa-tags text-muted-foreground"></i>
                        Category (Optional)
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category" className="h-12 text-base">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Dresses">Dresses</SelectItem>
                          <SelectItem value="Tops">Tops</SelectItem>
                          <SelectItem value="Bottoms">Bottoms</SelectItem>
                          <SelectItem value="Shoes">Shoes</SelectItem>
                          <SelectItem value="Accessories">Accessories</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>

              {/* Description */}
              <div className="bg-background/50 rounded-xl border p-6">
                <h4 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-align-left text-primary text-sm"></i>
                  </div>
                  Description
                </h4>
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      <i className="fas fa-file-text text-muted-foreground"></i>
                      Description (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Product description..." 
                        {...field}
                        data-testid="input-description"
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>

              {/* Image Upload */}
              <div className="bg-background/50 rounded-xl border p-6">
                <div className="mb-4">
                  <label className="text-lg font-medium text-foreground">
                    Product Image <span className="text-red-500">*</span>: Click to upload product image
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    PNG, JPG, GIF up to 10MB • High-quality images work best
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="w-full"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-center gap-6 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate("/products")}
                  data-testid="button-cancel"
                  className="h-12 px-8 text-base border-2 hover:bg-muted/50"
                >
                  <i className="fas fa-times mr-2"></i>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createProductMutation.isPending || !uploadedImageUrl}
                  data-testid="button-save-product"
                  className="h-12 px-8 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                >
                  {createProductMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner animate-spin mr-2"></i>
                      Saving Product...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      Save Product
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
