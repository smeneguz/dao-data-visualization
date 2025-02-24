import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Rectangle, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationAnalysisImproved = () => {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'decentralization_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'decentralization_analysis');
    }
  };

  // Enhanced statistical functions
  const calculateStatistics = (data) => {
    if (!data || data.length === 0) return null;
    
    // Largest holder statistics
    const holderValues = data.map(d => d.largestHolder);
    const sortedHolders = [...holderValues].sort((a, b) => a - b);
    const holderMean = _.mean(holderValues);
    const holderStd = Math.sqrt(_.sumBy(holderValues, x => Math.pow(x - holderMean, 2)) / (holderValues.length - 1));
    
    // Calculate quartiles
    const q1Index = Math.floor(holderValues.length * 0.25);
    const medianIndex = Math.floor(holderValues.length * 0.5);
    const q3Index = Math.floor(holderValues.length * 0.75);
    const holderQ1 = sortedHolders[q1Index];
    const holderMedian = sortedHolders[medianIndex];
    const holderQ3 = sortedHolders[q3Index];
    const holderIQR = holderQ3 - holderQ1;

    // Participation statistics
    const participationValues = data.map(d => d.participation);
    const sortedParticipation = [...participationValues].sort((a, b) => a - b);
    const participationMean = _.mean(participationValues);
    const participationStd = Math.sqrt(_.sumBy(participationValues, x => Math.pow(x - participationMean, 2)) / (participationValues.length - 1));
    const participationMedian = sortedParticipation[Math.floor(participationValues.length * 0.5)];
    const participationQ1 = sortedParticipation[Math.floor(participationValues.length * 0.25)];
    const participationQ3 = sortedParticipation[Math.floor(participationValues.length * 0.75)];

    // Calculate correlation
    const correlation = calculateCorrelation(holderValues, participationValues);

    // Categorize DAOs
    const categorizeDAO = (dao) => {
      // Invert logic for better visualization - lower values are better
      const decentralizationScore = 100 - dao.largestHolder;
      
      if (decentralizationScore < 34) return 'highly_centralized';
      if (decentralizationScore < 67) return 'moderately_centralized';
      if (decentralizationScore < 90) {
        if (dao.participation >= 10 && dao.automated) return 'medium_high';
        return 'medium';
      }
      return 'highly_decentralized';
    };

    const categories = data.reduce((acc, dao) => {
      const category = categorizeDAO(dao);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return {
      n: data.length,
      holder: {
        mean: holderMean,
        median: holderMedian,
        std: holderStd,
        q1: holderQ1,
        q3: holderQ3,
        iqr: holderIQR
      },
      participation: {
        mean: participationMean,
        median: participationMedian,
        std: participationStd,
        q1: participationQ1,
        q3: participationQ3
      },
      correlation,
      categories,
      automated: data.filter(d => d.automated).length,
      percentages: {
        highly_centralized: (categories.highly_centralized || 0) / data.length * 100,
        moderately_centralized: (categories.moderately_centralized || 0) / data.length * 100,
        medium: (categories.medium || 0) / data.length * 100,
        medium_high: (categories.medium_high || 0) / data.length * 100,
        highly_decentralized: (categories.highly_decentralized || 0) / data.length * 100
      }
    };
  };

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x, y) => {
    if (!x || !y || x.length !== y.length || x.length === 0) return 0;
    
    const xMean = _.mean(x);
    const yMean = _.mean(y);
    
    let numerator = 0;
    let xSumSquared = 0;
    let ySumSquared = 0;
    
    for (let i = 0; i < x.length; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSquared += xDiff * xDiff;
      ySumSquared += yDiff * yDiff;
    }
    
    // Avoid division by zero
    if (xSumSquared === 0 || ySumSquared === 0) return 0;
    
    return numerator / (Math.sqrt(xSumSquared) * Math.sqrt(ySumSquared));
  };

  useEffect(() => {
    const analyzeDecentralization = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process data points with data validation
        const processedData = jsonData
          .map(dao => {
            // Check for required data
            if (!dao || !dao.decentralisation || !dao.network_participation) {
              return null;
            }
            
            return {
              name: dao.dao_name,
              largestHolder: dao.decentralisation.largest_holder_percent,
              // Calculate decentralization score (inverted)
              decentralizationScore: 100 - dao.decentralisation.largest_holder_percent,
              participation: dao.network_participation.participation_rate,
              automated: dao.decentralisation.on_chain_automation === 'Yes',
              totalHolders: dao.decentralisation.token_distribution ? 
                Object.values(dao.decentralisation.token_distribution).reduce((acc, val) => acc + val, 0) : 0,
              proposerConcentration: dao.decentralisation.proposer_concentration,
              totalMembers: dao.network_participation.total_members
            };
          })
          .filter(d => d !== null)
          .filter(d => 
            !isNaN(d.largestHolder) && d.largestHolder >= 0 && d.largestHolder <= 100 &&
            !isNaN(d.participation) && d.participation >= 0
          );

        // Apply data transformation to limit outlier effects on the visualization
        const processedDataFiltered = processedData.map(d => ({
          ...d,
          // Cap participation at 100% for visualization clarity
          participation: Math.min(d.participation, 100)
        }));

        // Assign categories and colors
        const categorizedData = processedDataFiltered.map(dao => {
          // Calculate size based on members with log scaling to handle wide ranges
          const size = Math.max(5, Math.log(Math.max(10, dao.totalMembers)) / Math.log(10) * 3);
          
          let category, color;
          
          // Use the inverted score for categorization
          const score = dao.decentralizationScore;
          
          if (score < 34) {
            category = 'Highly Centralized';
            color = '#d32f2f'; // Red
          } else if (score < 67) {
            category = 'Moderately Centralized';
            color = '#f57c00'; // Orange
          } else if (score < 90) {
            if (dao.participation >= 10 && dao.automated) {
              category = 'Medium-High Decentralization';
              color = '#388e3c'; // Green
            } else {
              category = 'Medium Decentralization';
              color = '#7cb342'; // Light Green
            }
          } else {
            category = 'Highly Decentralized';
            color = '#1b5e20'; // Dark Green
          }
          
          return {
            ...dao,
            category,
            color,
            size
          };
        });

        const statistics = calculateStatistics(categorizedData);
        
        setStats(statistics);
        setData(categorizedData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeDecentralization();
  }, []);

  if (!data || !stats) return <div>Loading...</div>;
  
  // Cap the display range for clearer visualization
  const maxParticipation = Math.min(100, stats.participation.q3 * 2);

  return (
    <div style={{ width: '100%', padding: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => handleExport('svg')}
          style={{ marginRight: '10px', padding: '8px 16px', fontFamily: 'serif' }}
        >
          Export SVG
        </button>
        <button 
          onClick={() => handleExport('png')}
          style={{ padding: '8px 16px', fontFamily: 'serif' }}
        >
          Export High-Res PNG
        </button>
      </div>

      <div style={{ textAlign: 'center', fontFamily: 'serif', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>
          Figure 1.1: Multi-dimensional Analysis of DAO Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution of economic and governance decentralization metrics (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Decentralization Score: μ = {(100 - stats.holder.mean).toFixed(1)}% 
          (Median: {(100 - stats.holder.median).toFixed(1)}%, IQR: {(100 - stats.holder.q3).toFixed(1)}-{(100 - stats.holder.q1).toFixed(1)}%)
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Participation: μ = {stats.participation.mean.toFixed(1)}% 
          (Median: {stats.participation.median.toFixed(1)}%, IQR: {stats.participation.q1.toFixed(1)}-{stats.participation.q3.toFixed(1)}%)
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ScatterChart
            margin={{ top: 20, right: 50, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              type="number"
              dataKey="participation"
              domain={[0, maxParticipation]}
              tickFormatter={(value) => `${value}%`}
              name="Participation Rate"
            >
              <Label
                value="Participation Rate (%)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="decentralizationScore"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              name="Decentralization Score"
            >
              <Label
                value="Decentralization Score (%)"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Category zones with reference areas for clarity */}
            <ReferenceArea
              y1={0}
              y2={34}
              fill="#ffebee"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={34}
              y2={67}
              fill="#fff8e1"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={67}
              y2={90}
              fill="#e8f5e9"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={90}
              y2={100}
              fill="#c8e6c9"
              fillOpacity={0.4}
              ifOverflow="extendDomain"
            />

            {/* Category threshold lines */}
            <ReferenceLine 
              y={34} 
              stroke="#d32f2f" 
              strokeDasharray="3 3"
              label={{
                value: "High Centralization Threshold",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#d32f2f' }
              }}
            />
            <ReferenceLine 
              y={67} 
              stroke="#f57c00" 
              strokeDasharray="3 3"
              label={{
                value: "Moderate Decentralization",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#f57c00' }
              }}
            />
            <ReferenceLine 
              y={90} 
              stroke="#388e3c" 
              strokeDasharray="3 3"
              label={{
                value: "High Decentralization Threshold",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#388e3c' }
              }}
            />

            {/* Participation thresholds */}
            <ReferenceLine 
              x={10} 
              stroke="#666" 
              strokeDasharray="3 3"
              label={{
                value: "Minimum Participation (10%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Create a scatter series for each category for better legend */}
            {Object.entries(_.groupBy(data, 'category')).map(([category, items]) => (
              <Scatter
                key={`scatter-${category}`}
                name={category}
                data={items}
                fill={items[0].color}
              >
                {items.map((entry, index) => (
                  <Rectangle 
                    key={`rect-${index}`}
                    width={entry.automated ? 12 : 8}
                    height={entry.automated ? 12 : 8}
                    opacity={0.8}
                  />
                ))}
              </Scatter>
            ))}

            <Legend 
              verticalAlign="top" 
              height={36}
              formatter={(value) => {
                const categoryData = _.groupBy(data, 'category')[value] || [];
                const percentage = ((categoryData.length / data.length) * 100).toFixed(1);
                return (
                  <span style={{ fontFamily: 'serif', fontSize: '12px' }}>
                    {value} ({percentage}%)
                  </span>
                );
              }}
            />

            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      backgroundColor: 'white',
                      padding: '10px',
                      border: '1px solid #ccc',
                      fontFamily: 'serif'
                    }}>
                      <p style={{ fontWeight: 'bold' }}>{data.name}</p>
                      <p>Category: {data.category}</p>
                      <p>Decentralization Score: {data.decentralizationScore.toFixed(1)}%</p>
                      <p>Largest Holder: {data.largestHolder.toFixed(1)}%</p>
                      <p>Participation: {data.participation.toFixed(1)}%</p>
                      <p>On-chain Automation: {data.automated ? 'Yes' : 'No'}</p>
                      <p>Total Members: {data.totalMembers?.toLocaleString() || 'N/A'}</p>
                      {data.proposerConcentration !== undefined && (
                        <p>Proposer Concentration: {data.proposerConcentration.toFixed(1)}%</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Decentralization Analysis:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Economic Distribution:
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>High Centralization (Score &lt;34%): {stats.percentages.highly_centralized.toFixed(1)}%</li>
              <li>Moderate Decentralization (34-67%): {stats.percentages.moderately_centralized.toFixed(1)}%</li>
              <li>High Decentralization (&gt;67%): {(stats.percentages.medium + stats.percentages.medium_high + stats.percentages.highly_decentralized).toFixed(1)}%</li>
            </ul>
          </li>
          <li>Governance Classification:
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Medium with Automation: {stats.percentages.medium_high.toFixed(1)}%</li>
              <li>Medium without Automation: {stats.percentages.medium.toFixed(1)}%</li>
              <li>Highly Decentralized: {stats.percentages.highly_decentralized.toFixed(1)}%</li>
            </ul>
          </li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: The y-axis shows Decentralization Score (100% - Largest Holder %), where higher values indicate greater decentralization.
          Point size indicates membership scale, shape indicates automation status (larger squares = automated).
          Correlation between decentralization and participation is {
            Math.abs(stats.correlation) < 0.3 ? 'weak' :
            Math.abs(stats.correlation) < 0.7 ? 'moderate' : 'strong'
          } (ρ = {stats.correlation.toFixed(2)}). 
          Colored background regions indicate classification zones based on the paper's KPI framework.
          {stats.automated} DAOs ({((stats.automated/stats.n)*100).toFixed(1)}%) implement on-chain automation,
          which is considered a positive factor for governance decentralization.
        </p>
      </div>
    </div>
  );
};

export default DecentralizationAnalysisImproved;