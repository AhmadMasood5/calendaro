import Image from "next/image";
import {LandingHeader} from '@/components/landing/Landing-Header'
import {HeroSection} from '@/components/landing/Hero-Section'
import {FeaturesSection} from '@/components/landing/Features-Section'
import {HowItWorksSection} from '@/components/landing/how-it-works'
import {IntegrationSection} from '@/components/landing/Integraion'
import {CTASection} from '@/components/landing/cta-section'
export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <LandingHeader/>
      <HeroSection/>
      <FeaturesSection/>
      <HowItWorksSection/>
      <IntegrationSection/>
      <CTASection/>
    </div>
  );
}
