export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="px-6 py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
          {/* Company Info */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-2">Volume Fashion Collection</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-start">
                <i className="fas fa-map-marker-alt w-3 h-3 mt-0.5 mr-2 flex-shrink-0"></i>
                <span>4006-4008Room, 5Floor, Changjiang International Garment Building, No.931, Renmingbei Road, Yuexiu District, Guangzhou, China</span>
              </p>
              <p className="flex items-center">
                <i className="fas fa-phone w-3 h-3 mr-2"></i>
                <span>+86 132 8868 9165</span>
              </p>
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-6 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Volume Fashion Collection</span>
            <span>Fashion Inventory & Invoicing System</span>
          </div>
        </div>
      </div>
    </footer>
  );
}