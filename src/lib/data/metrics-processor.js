// src/lib/data/metrics-processor.js
export class MetricsProcessor {
  constructor(dataPath) {
    this.dataPath = dataPath;
  }

  async loadData() {
    try {
      const response = await fetch(this.dataPath);
      if (!response.ok) throw new Error('Data fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Error loading metrics:', error);
      throw error;
    }
  }

  processParticipationMetrics(rawData) {
    return rawData.map(dao => ({
      name: dao.dao_name,
      x: Math.log10(Math.max(1, dao.network_participation.total_members)),
      y: dao.network_participation.participation_rate,
      z: Math.log10(Math.max(1, dao.network_participation.num_distinct_voters + 1)),
      raw: {
        members: dao.network_participation.total_members,
        voters: dao.network_participation.num_distinct_voters,
        rate: dao.network_participation.participation_rate.toFixed(2)
      }
    })).filter(d => !isNaN(d.y) && d.y !== null);
  }
}