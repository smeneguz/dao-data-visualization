import ParticipationComplete from './components/visualization/KPIAnalysis/ParticipationAnalysisComplete';
import AccumulatedFundsAnalysisComplete from './components/visualization/KPIAnalysis/AccumulatedFundsAnalysisComplete';

function App() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <ParticipationComplete />
      <AccumulatedFundsAnalysisComplete />
    </div>
  );
}

export default App;