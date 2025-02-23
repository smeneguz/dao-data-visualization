import React from 'react';

import VotingEfficiencyAnalysis from './Voting_Efficiency/VotingEfficiencyAnalysis';
import VotingEfficiencyImproved from './Voting_Efficiency/VotingEfficiencyImproved';
import VotingDensityAnalysis from './Voting_Efficiency/VotingDensityAnalysis';
import VotingDensityImproved from './Voting_Efficiency/VotingDensityImproved';
import VotingThreshold from './Voting_Efficiency/VotingThreshold';

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

    </div>
  );
};

export default VotingEfficiencyAnalysisComplete;