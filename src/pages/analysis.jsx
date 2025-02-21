// src/pages/analysis.jsx
import React from 'react';
import ParticipationAnalysis from '../components/visualization/ParticipationAnalysis';
import ParticipationStatistics from '../components/visualization/ParticipationStatistics';

const AnalysisPage = () => {
  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">DAO KPI Analysis</h1>
      <ParticipationAnalysis />
      <ParticipationStatistics />
    </div>
  );
};

export default AnalysisPage;