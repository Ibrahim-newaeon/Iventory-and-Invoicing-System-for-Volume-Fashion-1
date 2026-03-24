import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Product } from "@shared/schema";

export default function ProductDetail() {
  const [match, params] = useRoute("/products/:id");
  const productId = params?.id;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  // Get all image URLs (prefer imageUrls array, fallback to single imageUrl)
  const imageUrls: string[] = product?.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls
    : product?.imageUrl
      ? [product.imageUrl]
      : [];

  const hasMultipleImages = imageUrls.length > 1;

  const goToImage = useCallback((index: number) => {
    setCurrentImageIndex(index);
  }, []);

  const nextImage = useCallback(() => {
    setCurrentImageIndex(prev => (prev + 1) % imageUrls.length);
  }, [imageUrls.length]);

  const prevImage = useCallback(() => {
    setCurrentImageIndex(prev => (prev - 1 + imageUrls.length) % imageUrls.length);
  }, [imageUrls.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImage();
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, prevImage, nextImage]);

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (quantity <= 5) {
      return <Badge variant="destructive">{quantity} Low Stock</Badge>;
    }
    return <Badge variant="secondary">{quantity} In Stock</Badge>;
  };

  if (!match) {
    return <div className="text-center py-8">Invalid product URL</div>;
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="w-full h-96 rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-exclamation-circle text-destructive text-6xl mb-4"></i>
        <h3 className="text-lg font-semibold text-foreground mb-2">Product Not Found</h3>
        <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => window.history.back()}>
          <i className="fas fa-arrow-left mr-2"></i>
          Go Back
        </Button>
      </div>
    );
  }

  const ImageCarousel = ({ inLightbox = false }: { inLightbox?: boolean }) => {
    const heightClass = inLightbox ? "h-[70vh]" : "h-96";
    return (
      <div className="relative">
        {imageUrls.length > 0 ? (
          <>
            <img
              src={imageUrls[currentImageIndex]}
              alt={`${product.productName} - Image ${currentImageIndex + 1}`}
              className={`w-full ${heightClass} ${inLightbox ? 'object-contain' : 'object-cover rounded-lg'} cursor-pointer transition-opacity duration-200`}
              onClick={() => {
                if (!inLightbox) setLightboxOpen(true);
              }}
            />

            {/* Navigation Arrows */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </>
            )}

            {/* Image Counter */}
            {hasMultipleImages && (
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                {currentImageIndex + 1} / {imageUrls.length}
              </div>
            )}

            {/* Dot Indicators */}
            {hasMultipleImages && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {imageUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); goToImage(index); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "bg-white scale-110"
                        : "bg-white/50 hover:bg-white/75"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={`w-full ${heightClass} bg-muted flex items-center justify-center rounded-lg`}>
            <i className="fas fa-image text-muted-foreground text-4xl"></i>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {/* Product Image Carousel */}
          <div className="space-y-4">
            <ImageCarousel />

            {/* Thumbnail Strip */}
            {hasMultipleImages && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imageUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => goToImage(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                      index === currentImageIndex
                        ? "border-primary ring-1 ring-primary"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* QR Code */}
            {product.qrCodeUrl && (
              <Card className="p-4">
                <div className="text-center">
                  <h4 className="text-sm font-medium mb-2">Product QR Code</h4>
                  <img
                    src={product.qrCodeUrl}
                    alt="Product QR Code"
                    className="w-32 h-32 mx-auto"
                  />
                  <p className="text-sm font-medium text-foreground mt-2">
                    {product.productName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scan to view this product
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {product.productName}
              </h1>
              <p className="text-muted-foreground text-lg">
                Product ID: {product.productId}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {getStockBadge(product.quantity)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Color</h3>
                  <p className="text-lg text-foreground">{product.color}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Size</h3>
                  <p className="text-lg text-foreground">{product.size}</p>
                </div>
              </div>

              {product.category && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
                  <Badge variant="outline">{product.category}</Badge>
                </div>
              )}

              {product.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                  <p className="text-foreground">{product.description}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Stock Level</h3>
                <p className="text-lg text-foreground">{product.quantity} units available</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="flex-1"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back
              </Button>
              <Button
                onClick={() => window.print()}
                className="flex-1"
              >
                <i className="fas fa-print mr-2"></i>
                Print Details
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-[95vw] p-2 bg-black/95 border-none">
          <ImageCarousel inLightbox />
        </DialogContent>
      </Dialog>
    </div>
  );
}