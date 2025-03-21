import ParticipationComplete from './components/visualization/KPIAnalysis/ParticipationAnalysisComplete';
import AccumulatedFundsAnalysisComplete from './components/visualization/KPIAnalysis/AccumulatedFundsAnalysisComplete';
import VotingEfficiencyAnalysisComplete from './components/visualization/KPIAnalysis/VotingEfficiencyAnalysisComplete';
import DecentralizationAnalysisComplete from './components/visualization/KPIAnalysis/DecentralizationAnalysisComplete';
import DAOSustainabilityTable from './components/visualization/KPIAnalysis/DAOSustainabilityTable';

function App() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <ParticipationComplete />
      <AccumulatedFundsAnalysisComplete />
      <VotingEfficiencyAnalysisComplete />
      <DecentralizationAnalysisComplete />
      <DAOSustainabilityTable />
    </div>
  );
}

export default App;