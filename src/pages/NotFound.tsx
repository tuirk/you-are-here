
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center text-white">
        <h1 className="text-4xl font-light mb-4">404 - Page Not Found</h1>
        <p className="text-xl font-thin mb-8 opacity-70">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button className="bg-cosmic-nebula-purple/60 hover:bg-cosmic-nebula-purple/80 text-white border border-cosmic-nebula-purple/30 backdrop-blur-sm px-6 py-2">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
