import ParticipationComplete from './components/visualization/KPIAnalysis/ParticipationAnalysisComplete';
import AccumulatedFundsAnalysisComplete from './components/visualization/KPIAnalysis/AccumulatedFundsAnalysisComplete';
import VotingEfficiencyAnalysisComplete from './components/visualization/KPIAnalysis/VotingEfficiencyAnalysisComplete';

function App() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <ParticipationComplete />
      <AccumulatedFundsAnalysisComplete />
      <VotingEfficiencyAnalysisComplete />
    </div>
  );
}

export default App;