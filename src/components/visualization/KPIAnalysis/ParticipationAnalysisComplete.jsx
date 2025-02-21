// src/components/visualization/KPIAnalysis/ParticipationAnalysisComplete.jsx
import React from 'react';
import ParticipationAnalysis from './Network_Participation/ParticipationAnalysis';
import ParticipationDistribution from './Network_Participation/ParticipationDistribution';
import ParticipationDensityAnalysis from './Network_Participation/ParticipationDensityAnalysis';
import ThresholdAnalysis from './Network_Participation/ThresholdAnalysis';

const ParticipationAnalysisComplete = () => {
  return (
    <div className="space-y-8">
      {/* Primary Scatter Plot */}
      <ParticipationAnalysis />
      
      {/* Distribution Analysis */}
      <ParticipationDistribution />

      {/* Density Analysis */}
      <ParticipationDensityAnalysis />
    
      {/* Threshold Analysis */}
      <ThresholdAnalysis />
    </div>
  );
};

export default ParticipationAnalysisComplete;