
import React from 'react';

import DecentralizationAnalysis from './Decentralization/DecentralizationAnalysis';
import DecentralizationAnalysisImproved from './Decentralization/DecentralizationAnalysisImproved';
import DecentralizationAnalysisImproved2 from './Decentralization/DecentralizationAnalysisImproved2.jsx';
import DecentralizationAnalysisImproved3 from './Decentralization/DecentralizationAnalysisImproved3.jsx';
import DecentralizationDistributionAnalysis from './Decentralization/DecentralizationDistributionAnalysis';
import DecentralizeDistributionimproved from './Decentralization/DecentralizeDistributionImproved.jsx';
import DecentralizeDistributionimproved2 from './Decentralization/DecentralizeDistributionImproved2.jsx';

const DecentralizationAnalysisComplete = () => {
  return (
    <div className="space-y-8">
      {/* Decentralization Analysis */}
      <DecentralizationAnalysis />

      <DecentralizationAnalysisImproved />
    
      <DecentralizationAnalysisImproved2 />

      <DecentralizationAnalysisImproved3 />

      <DecentralizationDistributionAnalysis />

      <DecentralizeDistributionimproved />

      <DecentralizeDistributionimproved2 />

    </div>
  );
};

export default DecentralizationAnalysisComplete;