import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Navbar } from "../components/landing/Navbar";
import { Hero } from "../components/landing/Hero";
import { ProductStatement } from "../components/landing/ProductStatement";
import { HowItWorks } from "../components/landing/HowItWorks";
import { ProductShowcase } from "../components/landing/ProductShowcase";
import { Features } from "../components/landing/Features";
import { SyncDifferentiator } from "../components/landing/SyncDifferentiator";
import { UseCases } from "../components/landing/UseCases";
import { BrandStatement } from "../components/landing/BrandStatement";
import { FinalCTA } from "../components/landing/FinalCTA";
import { Footer } from "../components/landing/Footer";

export function Landing() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/enter" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      <Navbar />
      <main className="pt-16">
        <Hero />
        <ProductStatement />
        <HowItWorks />
        <ProductShowcase />
        <Features />
        <SyncDifferentiator />
        <UseCases />
        <BrandStatement />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}