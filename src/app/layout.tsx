import { ReactNode, useState } from "react"; 
import "../index.css";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/sidebar/Sidebar";
import { cn } from '@/lib/utils'; 
import { ThemeProvider } from "@/components/providers/ThemeProvider";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // State for sidebar collapse

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Standard Flexbox layout */}
          <div className="flex h-screen over w-full">
            {/* Pass collapse state and toggle function to Sidebar */}
            <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={toggleSidebar} />
            {/* Main content area takes remaining space and handles its own scroll */}
            <main className={cn(
              "flex-1 overflow-auto min-w-0 transition-all duration-300 ease-in-out",
              isSidebarCollapsed ? "ml-6" : "ml-6" // Adjust left margin based on sidebar width
            )}>
              {children}
            </main>
            <Toaster />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
