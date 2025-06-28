import React from 'react';
import { PricingPage as PricingPageComponent } from '../modules/pricing';

interface PricingPageProps {
  onSkipToPro: () => void;
}

export default function PricingPage({ onSkipToPro }: PricingPageProps) {
  return <PricingPageComponent onSkipToPro={onSkipToPro} />;
}