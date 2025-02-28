import React, { useState, useEffect, useMemo } from 'react';
import _ from 'lodash';

const DAOSustainabilityDashboard = () => {
  const [data, setData] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: 'totalScore',
    direction: 'desc'
  });
  const [filterConfig, setFilterConfig] = useState({
    sustainability: 'all',
    searchTerm: ''
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Calculate KPI scores based on the paper's criteria
  const calculateNetworkParticipationScore = (participationRate) => {
    if (participationRate < 10) return 1; // Low
    if (participationRate <= 40) return 2; // Medium
    return 3; // High
  };

  const calculateAccumulatedFundsScore = (treasuryValue, circulatingPercentage) => {
    if (treasuryValue < 100000000) return 0.75; // Low
    
    if (treasuryValue <= 1000000000) {
      if (circulatingPercentage < 50) return 1.5; // Medium-Low
      return 2.25; // Medium-High
    }
    
    return 3; // High
  };

  const calculateVotingEfficiencyScore = (approvalRate, votingDuration) => {
    if (approvalRate < 30 || votingDuration < 2) return 1; // Low
    if (approvalRate <= 70 && votingDuration >= 3 && votingDuration <= 14) return 2; // Medium
    if (approvalRate > 70 && votingDuration >= 3 && votingDuration <= 14) return 3; // High
    return 1; // Default to Low if doesn't match criteria
  };

  const calculateDecentralizationScore = (largestHolderPercent, participationRate, onChainAutomation) => {
    if (largestHolderPercent > 66) return 0.6; // Low
    if (largestHolderPercent > 33) return 1.2; // Medium-Low
    
    // Medium and Medium-High categories
    if (largestHolderPercent > 10) {
      if (participationRate >= 10 && onChainAutomation === "Yes") {
        return 2.4; // Medium-High
      }
      return 1.8; // Medium
    }
    
    return 3; // High
  };

  // Function to determine sustainability level based on total score
  const getSustainabilityLevel = (score) => {
    if (score >= 9) return { level: 'High', color: '#4CAF50' };
    if (score >= 6) return { level: 'Medium', color: '#FFC107' };
    return { level: 'Low', color: '#F44336' };
  };

  useEffect(() => {
    const processData = async () => {
      try {
        setLoading(true);
        
        // Fetch and parse the data
        let jsonData;
        try {
          // First try with fetch (compatible with your other visualizations)
          const response = await fetch('/data/dao-metrics.json');
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          jsonData = await response.json();
        } catch (fetchError) {
          console.log("Fetch approach failed, trying window.fs method instead");
          try {
            // Fallback to window.fs method (which worked in our testing)
            const data = await window.fs.readFile('paste-3.txt', { encoding: 'utf8' });
            jsonData = JSON.parse(data);
          } catch (fsError) {
            console.error("Both fetch and fs methods failed", fsError);
            setLoading(false);
            return; // Exit early to show error state
          }
        }
        
        // Validate that we have data
        if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
          console.error("Invalid or empty data received");
          setLoading(false);
          return; // Exit early to show error state
        }
        
        // Process and score each DAO
        const processedData = jsonData.map(dao => {
          // Extract relevant metrics
          const participationRate = dao.network_participation.participation_rate;
          const treasuryValue = dao.accumulated_funds.treasury_value_usd;
          const circulatingPercentage = dao.accumulated_funds.circulating_token_percentage;
          const approvalRate = dao.voting_efficiency.approval_rate;
          const votingDuration = dao.voting_efficiency.avg_voting_duration_days;
          const largestHolderPercent = dao.decentralisation.largest_holder_percent;
          const onChainAutomation = dao.decentralisation.on_chain_automation;
          
          // Calculate scores for each KPI
          const participationScore = calculateNetworkParticipationScore(participationRate);
          const fundsScore = calculateAccumulatedFundsScore(treasuryValue, circulatingPercentage);
          const votingScore = calculateVotingEfficiencyScore(approvalRate, votingDuration);
          const decentralizationScore = calculateDecentralizationScore(
            largestHolderPercent, 
            participationRate, 
            onChainAutomation
          );
          
          // Calculate total score
          const totalScore = participationScore + fundsScore + votingScore + decentralizationScore;
          
          // Get sustainability level
          const sustainability = getSustainabilityLevel(totalScore);
          
          return {
            name: dao.dao_name,
            raw: {
              participation: participationRate,
              treasury: treasuryValue,
              circulating: circulatingPercentage,
              approvalRate: approvalRate,
              votingDuration: votingDuration,
              largestHolder: largestHolderPercent,
              automation: onChainAutomation
            },
            scores: {
              participation: participationScore,
              funds: fundsScore,
              voting: votingScore,
              decentralization: decentralizationScore
            },
            totalScore: totalScore,
            sustainability: sustainability
          };
        });
        
        // Calculate statistics
        const sustainabilityDistribution = {
          high: processedData.filter(d => d.sustainability.level === 'High').length,
          medium: processedData.filter(d => d.sustainability.level === 'Medium').length,
          low: processedData.filter(d => d.sustainability.level === 'Low').length,
        };

        const averageScores = {
          participation: processedData.reduce((sum, d) => sum + d.scores.participation, 0) / processedData.length,
          funds: processedData.reduce((sum, d) => sum + d.scores.funds, 0) / processedData.length,
          voting: processedData.reduce((sum, d) => sum + d.scores.voting, 0) / processedData.length,
          decentralization: processedData.reduce((sum, d) => sum + d.scores.decentralization, 0) / processedData.length,
          total: processedData.reduce((sum, d) => sum + d.totalScore, 0) / processedData.length
        };
        
        setStats({
          total: processedData.length,
          distribution: sustainabilityDistribution,
          averages: averageScores
        });
        
        setData(processedData);
        setLoading(false);
      } catch (error) {
        console.error('Error processing data:', error);
        setLoading(false);
      }
    };

    processData();
  }, []);

  // Filter data based on filter configuration
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    return data.filter(dao => {
      // Filter by sustainability level
      if (filterConfig.sustainability !== 'all' && 
          dao.sustainability.level.toLowerCase() !== filterConfig.sustainability) {
        return false;
      }
      
      // Filter by search term
      if (filterConfig.searchTerm && 
          !dao.name.toLowerCase().includes(filterConfig.searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [data, filterConfig]);

  // Sort filtered data based on sort configuration
  const sortedData = useMemo(() => {
    if (!filteredData.length) return [];
    
    const sortableData = [...filteredData];
    
    if (sortConfig.key.startsWith('scores.')) {
      sortableData.sort((a, b) => {
        const aValue = _.get(a, sortConfig.key);
        const bValue = _.get(b, sortConfig.key);
        
        if (sortConfig.direction === 'asc') {
          return aValue - bValue;
        }
        return bValue - aValue;
      });
    } else if (sortConfig.key === 'totalScore') {
      sortableData.sort((a, b) => {
        if (sortConfig.direction === 'asc') {
          return a.totalScore - b.totalScore;
        }
        return b.totalScore - a.totalScore;
      });
    } else {
      sortableData.sort((a, b) => {
        if (sortConfig.direction === 'asc') {
          return a.name.localeCompare(b.name);
        }
        return b.name.localeCompare(a.name);
      });
    }
    
    return sortableData;
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (field, value) => {
    setFilterConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper to create score indicator
  const ScoreIndicator = ({ score, maxScore }) => {
    const percentage = (score / maxScore) * 100;
    
    let color;
    if (percentage < 40) color = '#F44336'; // Red
    else if (percentage < 70) color = '#FFC107'; // Yellow
    else color = '#4CAF50'; // Green
    
    return (
      <div className="relative w-full h-4 bg-gray-200 rounded">
        <div 
          className="absolute h-4 rounded" 
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: color 
          }}
        ></div>
        <div className="absolute w-full text-center text-xs font-semibold leading-4 text-gray-800">
          {score.toFixed(1)}/{maxScore}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl font-serif">Loading DAO sustainability data...</div>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 p-4">
        <div className="text-xl font-serif mb-2 text-red-600">Error loading data</div>
        <p className="text-center text-gray-600">
          Could not load DAO metrics data. Please ensure the data file is accessible 
          and properly formatted.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h1 className="text-3xl font-serif font-bold mb-2 text-center">DAO Sustainability Analysis</h1>
      <p className="text-center mb-6 text-gray-600 font-serif">
        Comprehensive evaluation of {data.length} DAOs based on four key performance indicators
      </p>
      
      {/* Statistics Summary */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded shadow">
            <h3 className="font-serif font-semibold mb-2">Sustainability Distribution</h3>
            <div className="flex items-center mb-2">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="h-4 rounded-l-full" 
                  style={{ 
                    width: `${(stats.distribution.low / stats.total) * 100}%`,
                    backgroundColor: '#F44336'
                  }}
                ></div>
              </div>
              <span className="ml-2 text-sm">{stats.distribution.low} ({((stats.distribution.low / stats.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center mb-2">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="h-4 rounded-l-full" 
                  style={{ 
                    width: `${(stats.distribution.medium / stats.total) * 100}%`,
                    backgroundColor: '#FFC107'
                  }}
                ></div>
              </div>
              <span className="ml-2 text-sm">{stats.distribution.medium} ({((stats.distribution.medium / stats.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="h-4 rounded-l-full" 
                  style={{ 
                    width: `${(stats.distribution.high / stats.total) * 100}%`,
                    backgroundColor: '#4CAF50'
                  }}
                ></div>
              </div>
              <span className="ml-2 text-sm">{stats.distribution.high} ({((stats.distribution.high / stats.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>Low Sustainability</span>
              <span>Medium Sustainability</span>
              <span>High Sustainability</span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded shadow">
            <h3 className="font-serif font-semibold mb-2">Average KPI Scores</h3>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Network Participation</span>
                <span>{stats.averages.participation.toFixed(2)}/3</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${(stats.averages.participation / 3) * 100}%`,
                    backgroundColor: '#3B82F6'
                  }}
                ></div>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Accumulated Funds</span>
                <span>{stats.averages.funds.toFixed(2)}/3</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${(stats.averages.funds / 3) * 100}%`,
                    backgroundColor: '#3B82F6'
                  }}
                ></div>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Voting Efficiency</span>
                <span>{stats.averages.voting.toFixed(2)}/3</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${(stats.averages.voting / 3) * 100}%`,
                    backgroundColor: '#3B82F6'
                  }}
                ></div>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Decentralisation</span>
                <span>{stats.averages.decentralization.toFixed(2)}/3</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${(stats.averages.decentralization / 3) * 100}%`,
                    backgroundColor: '#3B82F6'
                  }}
                ></div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Overall Average</span>
                <span>{stats.averages.total.toFixed(2)}/12</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${(stats.averages.total / 12) * 100}%`,
                    backgroundColor: '#3B82F6'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by DAO name..."
            className="w-full p-2 border border-gray-300 rounded"
            value={filterConfig.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
          />
        </div>
        <div>
          <select
            className="p-2 border border-gray-300 rounded w-full sm:w-auto"
            value={filterConfig.sustainability}
            onChange={(e) => handleFilterChange('sustainability', e.target.value)}
          >
            <option value="all">All Sustainability Levels</option>
            <option value="high">High Sustainability</option>
            <option value="medium">Medium Sustainability</option>
            <option value="low">Low Sustainability</option>
          </select>
        </div>
        <div className="text-sm text-gray-600 self-center">
          Showing {sortedData.length} of {data.length} DAOs
        </div>
      </div>
      
      {/* Main Data Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="p-3 text-left font-serif cursor-pointer" onClick={() => requestSort('name')}>
                DAO Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif cursor-pointer" onClick={() => requestSort('scores.participation')}>
                Network Participation {sortConfig.key === 'scores.participation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif cursor-pointer" onClick={() => requestSort('scores.funds')}>
                Accumulated Funds {sortConfig.key === 'scores.funds' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif cursor-pointer" onClick={() => requestSort('scores.voting')}>
                Voting Efficiency {sortConfig.key === 'scores.voting' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif cursor-pointer" onClick={() => requestSort('scores.decentralization')}>
                Decentralisation {sortConfig.key === 'scores.decentralization' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif cursor-pointer" onClick={() => requestSort('totalScore')}>
                Total Score {sortConfig.key === 'totalScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 text-center font-serif">Sustainability Level</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((dao, index) => (
              <tr 
                key={dao.name} 
                className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
              >
                <td className="p-3 font-serif font-medium">{dao.name}</td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <ScoreIndicator score={dao.scores.participation} maxScore={3} />
                    <div className="text-xs mt-1 text-gray-500 text-center">
                      {dao.raw.participation.toFixed(1)}%
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <ScoreIndicator score={dao.scores.funds} maxScore={3} />
                    <div className="text-xs mt-1 text-gray-500 text-center">
                      ${dao.raw.treasury >= 1000000 
                        ? (dao.raw.treasury / 1000000).toFixed(1) + 'M' 
                        : dao.raw.treasury.toFixed(0)} / {dao.raw.circulating.toFixed(1)}%
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <ScoreIndicator score={dao.scores.voting} maxScore={3} />
                    <div className="text-xs mt-1 text-gray-500 text-center">
                      {dao.raw.approvalRate.toFixed(1)}% / {dao.raw.votingDuration.toFixed(1)}d
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <ScoreIndicator score={dao.scores.decentralization} maxScore={3} />
                    <div className="text-xs mt-1 text-gray-500 text-center">
                      {dao.raw.largestHolder.toFixed(1)}% / {dao.raw.automation}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex justify-center">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: dao.sustainability.color }}
                    >
                      {dao.totalScore.toFixed(1)}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-center" style={{ color: dao.sustainability.color }}>
                  <div className="font-bold">{dao.sustainability.level}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* KPI Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="font-serif font-semibold mb-2">KPI Scoring Legend:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-serif font-medium">Network Participation (1-3):</h4>
            <ul className="list-disc ml-5 text-sm">
              <li>Low (&lt;10%): 1 point</li>
              <li>Medium (11%-40%): 2 points</li>
              <li>High (&gt;41%): 3 points</li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif font-medium">Accumulated Funds (0.75-3):</h4>
            <ul className="list-disc ml-5 text-sm">
              <li>Low (&lt;$100M): 0.75 points</li>
              <li>Medium-Low ($100M-$1B, &lt;50% circulating): 1.5 points</li>
              <li>Medium-High ($100M-$1B, &gt;51% circulating): 2.25 points</li>
              <li>High (&gt;$1B): 3 points</li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif font-medium">Voting Efficiency (1-3):</h4>
            <ul className="list-disc ml-5 text-sm">
              <li>Low (approval &lt;30% or duration &lt;2 days): 1 point</li>
              <li>Medium (approval 31%-70%, duration 3-14 days): 2 points</li>
              <li>High (approval &gt;71%, duration 3-14 days): 3 points</li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif font-medium">Decentralisation (0.6-3):</h4>
            <ul className="list-disc ml-5 text-sm">
              <li>Low (largest holder &gt;66%): 0.6 points</li>
              <li>Medium-Low (largest holder 34%-66%): 1.2 points</li>
              <li>Medium (largest holder 11%-33%, medium participation, not fully automated): 1.8 points</li>
              <li>Medium-High (largest holder 11%-33%, medium/high participation, fully automated): 2.4 points</li>
              <li>High (largest holder &lt;10%): 3 points</li>
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <h4 className="font-serif font-medium">Sustainability Levels (Total Score):</h4>
          <ul className="list-disc ml-5 text-sm">
            <li><span className="font-medium" style={{ color: '#F44336' }}>Low Sustainability</span>: &lt;6 points</li>
            <li><span className="font-medium" style={{ color: '#FFC107' }}>Medium Sustainability</span>: 6-8.9 points</li>
            <li><span className="font-medium" style={{ color: '#4CAF50' }}>High Sustainability</span>: ≥9 points</li>
          </ul>
        </div>
      </div>
      
      {/* Methodology Explanation */}
      <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="font-serif font-semibold mb-2">Methodology & Sustainability Framework</h3>
        <p className="text-sm mb-3">
          The sustainability and longevity of DAOs is assessed through a balanced framework measuring four critical dimensions:
        </p>
        <ol className="list-decimal ml-5 text-sm">
          <li><strong>Community Engagement</strong> (Network Participation): Measures active involvement of members in governance processes, crucial for maintaining decentralized decision-making.</li>
          <li><strong>Financial Robustness</strong> (Accumulated Funds): Evaluates treasury size and token distribution, essential for funding ongoing operations and initiatives.</li>
          <li><strong>Governance Efficiency</strong> (Voting Mechanism): Assesses the approval rate of proposals and voting duration, indicating the effectiveness of decision-making processes.</li>
          <li><strong>Decentralisation</strong>: Measures the distribution of power within the DAO, considering token concentration, participation, and automation of governance.</li>
        </ol>
        <p className="text-sm mt-3">
          This multi-dimensional approach provides a comprehensive evaluation of DAO sustainability, identifying both strengths and areas for improvement across the ecosystem.
        </p>
      </div>
      
      {/* Statistical Summary */}
      <div className="mt-4 text-xs text-gray-500 text-center font-serif">
        Analysis based on {data.length} DAOs, data collected on February 2025. Calculations follow methodologies defined in the paper 
        "Decentralised Autonomous Organisations: Evaluating Sustainability through Key Performance Indicators".
      </div>
    </div>
  );
};

export default DAOSustainabilityDashboard;