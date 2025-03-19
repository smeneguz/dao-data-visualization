import React from 'react';

import VotingEfficiencyAnalysis from './Voting_Efficiency/VotingEfficiencyAnalysis';
import VotingEfficiencyImproved from './Voting_Efficiency/VotingEfficiencyImproved';
import VotingDensityAnalysis from './Voting_Efficiency/VotingDensityAnalysis';
import VotingDensityImproved from './Voting_Efficiency/VotingDensityImproved';
import VotingThreshold from './Voting_Efficiency/VotingThreshold';
import VotingEfficiencyBoxplot from './Voting_Efficiency/VotingEfficiencyBoxplot';
import VotingEfficiencyBoxPlotImproved from './Voting_Efficiency/VotingEfficiencyBoxPlotImproved';

const VotingEfficiencyAnalysisComplete = () => {
  return (
    <div className="space-y-8">
      {/* Voting Efficiency Analysis */}
      <VotingEfficiencyAnalysis />
    
      {/* Voting Efficiency Improved */}
      <VotingEfficiencyImproved />

      
      <VotingDensityAnalysis />
    

      <VotingDensityImproved />

      <VotingThreshold />

      <VotingEfficiencyBoxplot />

      <VotingEfficiencyBoxPlotImproved />

    </div>
  );
};

export default VotingEfficiencyAnalysisComplete;