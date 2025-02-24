// src/components/visualization/KPIAnalysis/AccumulatedFundsAnalysisComplete.jsx
import React from 'react';

import AccumulatedFundsAnalysis from './Accumulated_Fund/AccumulatedFundsAnalysis';
import AccumulatedFundsDistribution from './Accumulated_Fund/AccumulatedFundsDistribution';
import TreasuryThresholdAnalysis from './Accumulated_Fund/TreasuryThresholdAnalysis';

const AccumulatedFundsAnalysisComplete = () => {
  return (
    <div className="space-y-8">
      {/* Accumulated Funds Analysis */}
      <AccumulatedFundsAnalysis />

      {/* Accumulated Funds Distribution */}
      <AccumulatedFundsDistribution />

      {/* Treasury Threshold Analysis */}
      <TreasuryThresholdAnalysis />
      
    </div>
  );
};

export default AccumulatedFundsAnalysisComplete;