import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Rectangle, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationAnalysisImproved3 = () => {
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
    
    // Extract metrics
    const largestHolderValues = data.map(d => d.largestHolder);
    const participationValues = data.map(d => d.participation);
    
    // Calculate quantiles for robust statistics
    const sortedHolders = [...largestHolderValues].sort((a, b) => a - b);
    const sortedParticipation = [...participationValues].sort((a, b) => a - b);
    
    const holderMean = _.mean(largestHolderValues);
    const holderMedian = sortedHolders[Math.floor(sortedHolders.length * 0.5)];
    const holderStd = Math.sqrt(_.sumBy(largestHolderValues, x => Math.pow(x - holderMean, 2)) / (largestHolderValues.length - 1));
    const holderQ1 = sortedHolders[Math.floor(sortedHolders.length * 0.25)];
    const holderQ3 = sortedHolders[Math.floor(sortedHolders.length * 0.75)];
    
    const participationMean = _.mean(participationValues);
    const participationMedian = sortedParticipation[Math.floor(sortedParticipation.length * 0.5)];
    const participationStd = Math.sqrt(_.sumBy(participationValues, x => Math.pow(x - participationMean, 2)) / (participationValues.length - 1));
    const participationQ1 = sortedParticipation[Math.floor(participationValues.length * 0.25)];
    const participationQ3 = sortedParticipation[Math.floor(participationValues.length * 0.75)];

    // Calculate correlation
    const correlation = calculateCorrelation(largestHolderValues, participationValues);

    // Paper-defined thresholds for categories
    const categorizeDAO = (dao) => {
      if (dao.largestHolder > 66) return 'low';
      if (dao.largestHolder > 33) return 'mediumLow';
      if (dao.largestHolder > 10) {
        if (dao.participation >= 10 && dao.automated) return 'mediumHigh';
        return 'medium';
      }
      return 'high';
    };

    // Count DAOs in each category
    const categoryCount = data.reduce((acc, dao) => {
      const category = categorizeDAO(dao);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Participation distribution
    const lowParticipation = data.filter(d => d.participation < 10).length;
    const highParticipation = data.filter(d => d.participation > 40).length;
    const mediumParticipation = data.length - lowParticipation - highParticipation;

    return {
      n: data.length,
      largestHolder: {
        mean: holderMean,
        median: holderMedian,
        std: holderStd,
        q1: holderQ1,
        q3: holderQ3
      },
      participation: {
        mean: participationMean,
        median: participationMedian,
        std: participationStd,
        q1: participationQ1,
        q3: participationQ3,
        max: Math.max(...participationValues),
        distribution: {
          low: lowParticipation,
          medium: mediumParticipation,
          high: highParticipation
        }
      },
      correlation,
      automated: data.filter(d => d.automated).length,
      categories: categoryCount,
      percentages: {
        low: (categoryCount.low || 0) / data.length * 100,
        mediumLow: (categoryCount.mediumLow || 0) / data.length * 100,
        medium: (categoryCount.medium || 0) / data.length * 100,
        mediumHigh: (categoryCount.mediumHigh || 0) / data.length * 100,
        high: (categoryCount.high || 0) / data.length * 100
      },
      participationPercentages: {
        low: (lowParticipation / data.length) * 100,
        medium: (mediumParticipation / data.length) * 100,
        high: (highParticipation / data.length) * 100
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

        // Process data points with validation
        const processedData = jsonData
          .map(dao => {
            // Check for required data
            if (!dao || !dao.decentralisation || !dao.network_participation) {
              return null;
            }
            
            return {
              name: dao.dao_name,
              largestHolder: dao.decentralisation.largest_holder_percent,
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

        // Manage outliers - cap participation at 100% for visualization
        const normalizedData = processedData.map(d => ({
          ...d,
          participation: Math.min(d.participation, 100)
        }));

        // Assign categories and colors per paper definitions
        const categorizedData = normalizedData.map(dao => {
          let category, color, score;
          
          if (dao.largestHolder > 66) {
            category = 'Low';
            color = '#d32f2f'; // Red
            score = 0.6;
          } else if (dao.largestHolder > 33) {
            category = 'Medium-Low';
            color = '#f57c00'; // Orange
            score = 1.2;
          } else if (dao.largestHolder > 10) {
            if (dao.participation >= 10 && dao.automated) {
              category = 'Medium-High';
              color = '#388e3c'; // Green
              score = 2.4;
            } else {
              category = 'Medium';
              color = '#7cb342'; // Light Green
              score = 1.8;
            }
          } else {
            category = 'High';
            color = '#1b5e20'; // Dark Green
            score = 3.0;
          }
          
          return {
            ...dao,
            category,
            color,
            score,
            // Scale point size based on membership with better visibility
            size: Math.max(6, Math.log10(dao.totalMembers || 100) * 3)
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
          Figure 1.3: Multi-dimensional Analysis of DAO Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution of economic and governance decentralization metrics (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Largest Holder: μ = {stats.largestHolder.mean.toFixed(1)}% 
          (Median: {stats.largestHolder.median.toFixed(1)}%, IQR: {stats.largestHolder.q1.toFixed(1)}-{stats.largestHolder.q3.toFixed(1)}%)
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
              dataKey="largestHolder"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              name="Largest Holder"
            >
              <Label
                value="Largest Holder Percentage (%)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="participation"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              name="Participation Rate"
            >
              <Label
                value="Participation Rate (%)"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Category zones with colored backgrounds */}
            <ReferenceArea
              x1={66}
              x2={100}
              fill="#ffcdd2"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={33}
              x2={66}
              fill="#ffe0b2"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={10}
              x2={33}
              fill="#c8e6c9"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={0}
              x2={10}
              fill="#a5d6a7"
              fillOpacity={0.4}
              ifOverflow="extendDomain"
            />

            {/* Participation threshold area for Medium-High upgrade */}
            <ReferenceArea
              x1={10}
              x2={33}
              y1={10}
              y2={100}
              fill="#66bb6a"
              fillOpacity={0.2}
              stroke="#388e3c"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />

            {/* Economic decentralization thresholds */}
            <ReferenceLine 
              x={66} 
              stroke="#d32f2f" 
              strokeDasharray="3 3"
              label={{
                value: "Low Threshold (66%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#d32f2f' }
              }}
            />
            <ReferenceLine 
              x={33} 
              stroke="#f57c00" 
              strokeDasharray="3 3"
              label={{
                value: "Medium Threshold (33%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#f57c00' }
              }}
            />
            <ReferenceLine 
              x={10} 
              stroke="#388e3c" 
              strokeDasharray="3 3"
              label={{
                value: "High Threshold (10%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#388e3c' }
              }}
            />

            {/* Participation thresholds */}
            <ReferenceLine 
              y={10} 
              stroke="#666" 
              strokeDasharray="3 3"
              label={{
                value: "Min Participation (10%)",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine 
              y={40} 
              stroke="#666" 
              strokeDasharray="3 3"
              label={{
                value: "High Participation (40%)",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Data points by category */}
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
                    {value} Decentralization ({percentage}%)
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
                      <p>Decentralization: {data.category}</p>
                      <p>Largest Holder: {data.largestHolder.toFixed(1)}%</p>
                      <p>Participation: {data.participation.toFixed(1)}%</p>
                      <p>On-chain Automation: {data.automated ? 'Yes' : 'No'}</p>
                      <p>Total Members: {data.totalMembers?.toLocaleString() || 'N/A'}</p>
                      <p>KPI Score: {data.score.toFixed(1)} / 3.0</p>
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
        <div style={{ display: 'flex', flexDirection: 'row', gap: '40px' }}>
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Economic Decentralization:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li>Low (Largest Holder &gt;66%): {stats.percentages.low.toFixed(1)}%</li>
              <li>Medium-Low (33-66%): {stats.percentages.mediumLow.toFixed(1)}%</li>
              <li>Medium (10-33%, &lt;10% participation or no automation): {stats.percentages.medium.toFixed(1)}%</li>
              <li>Medium-High (10-33%, &gt;10% participation, with automation): {stats.percentages.mediumHigh.toFixed(1)}%</li>
              <li>High (Largest Holder &lt;10%): {stats.percentages.high.toFixed(1)}%</li>
            </ul>
          </div>
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Participation Distribution:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li>Low Participation (&lt;10%): {stats.participationPercentages.low.toFixed(1)}%</li>
              <li>Medium Participation (10-40%): {stats.participationPercentages.medium.toFixed(1)}%</li>
              <li>High Participation (&gt;40%): {stats.participationPercentages.high.toFixed(1)}%</li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '11px' }}>
          <strong>Methodology note:</strong>
          The x-axis shows the percentage held by the largest token holder (lower values = more decentralized), while 
          the y-axis shows participation rate. The colored areas represent the decentralization classification thresholds, 
          with the darker green area (10-33% largest holder, &gt;10% participation) highlighting where DAOs can achieve 
          Medium-High classification if they implement on-chain automation.
        </p>
        <p style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '11px' }}>
          Correlation between largest holder percentage and participation is {
            Math.abs(stats.correlation) < 0.3 ? 'weak' :
            Math.abs(stats.correlation) < 0.7 ? 'moderate' : 'strong'
          } (ρ = {stats.correlation.toFixed(2)}). 
          {stats.automated} DAOs ({((stats.automated/stats.n)*100).toFixed(1)}%) implement on-chain automation,
          which upgrades them from Medium to Medium-High category when other criteria are met.
        </p>
      </div>
    </div>
  );
};

export default DecentralizationAnalysisImproved3;