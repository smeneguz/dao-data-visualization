import React from 'react';

import VotingEfficiencyAnalysis from './Voting_Efficiency/VotingEfficiencyAnalysis';
import VotingEfficiencyImproved from './Voting_Efficiency/VotingEfficiencyImproved';

const VotingEfficiencyAnalysisComplete = () => {
  return (
    <div className="space-y-8">
      {/* Voting Efficiency Analysis */}
      <VotingEfficiencyAnalysis />

      <VotingEfficiencyImproved />

    </div>
  );
};

export default VotingEfficiencyAnalysisComplete;