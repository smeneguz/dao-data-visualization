import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Rectangle, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationAnalysisImproved2 = () => {
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

  // Comprehensive statistical analysis function
  const calculateStatistics = (data) => {
    if (!data || data.length === 0) return null;
    
    // Extract core metrics
    const largestHolderValues = data.map(d => d.largestHolder);
    const participationValues = data.map(d => d.participation);
    const automationValues = data.map(d => d.automated ? 1 : 0);
    
    // Calculate quantiles for more robust statistics
    const calculateQuantile = (values, q) => {
      const sorted = [...values].sort((a, b) => a - b);
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (base + 1 < sorted.length) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    };
    
    // Largest holder statistics
    const holderMean = _.mean(largestHolderValues);
    const holderMedian = calculateQuantile(largestHolderValues, 0.5);
    const holderStd = Math.sqrt(_.sumBy(largestHolderValues, x => Math.pow(x - holderMean, 2)) / (largestHolderValues.length - 1));
    const holderQ1 = calculateQuantile(largestHolderValues, 0.25);
    const holderQ3 = calculateQuantile(largestHolderValues, 0.75);
    const holderIQR = holderQ3 - holderQ1;
    
    // Calculate skewness and kurtosis for distribution analysis
    const holderSkewness = largestHolderValues.reduce((sum, val) => 
      sum + Math.pow((val - holderMean) / holderStd, 3), 0) / largestHolderValues.length;
    
    const holderKurtosis = largestHolderValues.reduce((sum, val) => 
      sum + Math.pow((val - holderMean) / holderStd, 4), 0) / largestHolderValues.length - 3;
    
    // Inverted metrics for decentralization score
    const decentralizationValues = largestHolderValues.map(v => 100 - v);
    const decentralizationMean = _.mean(decentralizationValues);
    const decentralizationMedian = calculateQuantile(decentralizationValues, 0.5);
    const decentralizationQ1 = calculateQuantile(decentralizationValues, 0.25);
    const decentralizationQ3 = calculateQuantile(decentralizationValues, 0.75);
    
    // Participation statistics
    const participationMean = _.mean(participationValues);
    const participationMedian = calculateQuantile(participationValues, 0.5);
    const participationStd = Math.sqrt(_.sumBy(participationValues, x => Math.pow(x - participationMean, 2)) / (participationValues.length - 1));
    const participationQ1 = calculateQuantile(participationValues, 0.25);
    const participationQ3 = calculateQuantile(participationValues, 0.75);
    
    // Calculate correlation matrix
    const correlations = {
      decentralizationParticipation: calculateCorrelation(decentralizationValues, participationValues),
      decentralizationAutomation: calculateCorrelation(decentralizationValues, automationValues),
      participationAutomation: calculateCorrelation(participationValues, automationValues)
    };
    
    // Categorize according to paper thresholds
    const categories = {
      low: data.filter(d => d.largestHolder > 66).length,
      mediumLow: data.filter(d => d.largestHolder > 33 && d.largestHolder <= 66).length,
      medium: data.filter(d => 
        d.largestHolder > 10 && d.largestHolder <= 33 && 
        d.participation >= 10 && !d.automated
      ).length,
      mediumHigh: data.filter(d => 
        d.largestHolder > 10 && d.largestHolder <= 33 && 
        d.participation >= 10 && d.automated
      ).length,
      high: data.filter(d => d.largestHolder <= 10).length
    };
    
    // Additional statistics for interpretation
    const totalAutomated = data.filter(d => d.automated).length;
    const lowParticipationCount = data.filter(d => d.participation < 10).length;
    const highParticipationCount = data.filter(d => d.participation > 40).length;
    
    return {
      n: data.length,
      holder: {
        mean: holderMean,
        median: holderMedian,
        std: holderStd,
        q1: holderQ1,
        q3: holderQ3,
        iqr: holderIQR,
        skewness: holderSkewness,
        kurtosis: holderKurtosis
      },
      decentralization: {
        mean: decentralizationMean,
        median: decentralizationMedian,
        q1: decentralizationQ1,
        q3: decentralizationQ3
      },
      participation: {
        mean: participationMean,
        median: participationMedian,
        std: participationStd,
        q1: participationQ1,
        q3: participationQ3,
        lowCount: lowParticipationCount,
        lowPercent: (lowParticipationCount / data.length) * 100,
        highCount: highParticipationCount,
        highPercent: (highParticipationCount / data.length) * 100
      },
      automation: {
        count: totalAutomated,
        percent: (totalAutomated / data.length) * 100
      },
      correlations,
      categories,
      categoryPercentages: {
        low: (categories.low / data.length) * 100,
        mediumLow: (categories.mediumLow / data.length) * 100,
        medium: (categories.medium / data.length) * 100,
        mediumHigh: (categories.mediumHigh / data.length) * 100,
        high: (categories.high / data.length) * 100
      }
    };
  };

  // Calculate Pearson correlation coefficient with validation
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

        // Process data points with robust validation
        const processedData = jsonData
          .map(dao => {
            // Check for required data
            if (!dao || !dao.decentralisation || !dao.network_participation) {
              return null;
            }
            
            // Extract and validate core metrics
            const largestHolder = dao.decentralisation.largest_holder_percent;
            const participation = dao.network_participation.participation_rate;
            const automated = dao.decentralisation.on_chain_automation === 'Yes';
            
            if (isNaN(largestHolder) || largestHolder < 0 || largestHolder > 100 ||
                isNaN(participation) || participation < 0) {
              return null;
            }
            
            return {
              name: dao.dao_name || 'Unknown',
              largestHolder,
              decentralizationScore: 100 - largestHolder,
              participation: Math.min(participation, 100), // Cap at 100% for visualization
              automated,
              totalHolders: dao.decentralisation.token_distribution ? 
                Object.values(dao.decentralisation.token_distribution).reduce((acc, val) => acc + val, 0) : 0,
              proposerConcentration: dao.decentralisation.proposer_concentration,
              totalMembers: dao.network_participation.total_members,
              uniqueProposers: dao.network_participation.unique_proposers
            };
          })
          .filter(d => d !== null);

        // Assign categories and colors based on paper definitions
        const categorizedData = processedData.map(dao => {
          let category, color, description;
          
          if (dao.largestHolder > 66) {
            category = 'Low Decentralization';
            color = '#d32f2f'; // Red
            description = 'Highly Centralized';
          } else if (dao.largestHolder > 33) {
            category = 'Medium-Low Decentralization';
            color = '#f57c00'; // Orange
            description = 'Moderately Centralized';
          } else if (dao.largestHolder > 10) {
            if (dao.participation >= 10 && dao.automated) {
              category = 'Medium-High Decentralization';
              color = '#388e3c'; // Green
              description = 'Medium-High';
            } else {
              category = 'Medium Decentralization';
              color = '#7cb342'; // Light Green
              description = 'Medium';
            }
          } else {
            category = 'High Decentralization';
            color = '#1b5e20'; // Dark Green
            description = 'Highly Decentralized';
          }
          
          // Scale point size by membership or total holders (using log scale)
          const size = Math.max(6, Math.log10(dao.totalMembers || 100) * 5);
          
          return {
            ...dao,
            category,
            color,
            description,
            size
          };
        });

        // Calculate comprehensive statistics
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
          Figure 1.2: Multi-dimensional Analysis of DAO Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution of economic and political decentralization metrics (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Decentralization Score: μ = {stats.decentralization.mean.toFixed(1)}% 
          (Median: {stats.decentralization.median.toFixed(1)}%, IQR: {stats.decentralization.q1.toFixed(1)}-{stats.decentralization.q3.toFixed(1)}%)
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
            
            {/* X-axis shows decentralization score */}
            <XAxis 
              type="number"
              dataKey="decentralizationScore"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              name="Decentralization Score"
            >
              <Label
                value="Decentralization Score (100% - Largest Holder %)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            
            {/* Y-axis shows participation rate */}
            <YAxis
              type="number"
              dataKey="participation"
              domain={[0, 'auto']}
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

            {/* Decentralization threshold regions */}
            <ReferenceArea
              x1={0}
              x2={34}
              fill="#ffcdd2"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={34}
              x2={67}
              fill="#ffe0b2"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={67}
              x2={90}
              fill="#c8e6c9"
              fillOpacity={0.3}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              x1={90}
              x2={100}
              fill="#a5d6a7"
              fillOpacity={0.4}
              ifOverflow="extendDomain"
            />

            {/* Decentralization threshold lines based on paper */}
            <ReferenceLine 
              x={34} 
              stroke="#d32f2f" 
              strokeDasharray="3 3"
              label={{
                value: "Low (34%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#d32f2f' }
              }}
            />
            <ReferenceLine 
              x={67} 
              stroke="#f57c00" 
              strokeDasharray="3 3"
              label={{
                value: "Medium (67%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#f57c00' }
              }}
            />
            <ReferenceLine 
              x={90} 
              stroke="#388e3c" 
              strokeDasharray="3 3"
              label={{
                value: "High (90%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#388e3c' }
              }}
            />

            {/* Participation thresholds based on paper */}
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

            {/* Scatter plots by category */}
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
                      <p>Category: {data.description}</p>
                      <p>Decentralization Score: {data.decentralizationScore.toFixed(1)}%</p>
                      <p>Largest Holder: {data.largestHolder.toFixed(1)}%</p>
                      <p>Participation: {data.participation.toFixed(1)}%</p>
                      <p>On-chain Automation: {data.automated ? 'Yes' : 'No'}</p>
                      <p>Total Members: {data.totalMembers?.toLocaleString() || 'N/A'}</p>
                      {data.uniqueProposers !== undefined && (
                        <p>Unique Proposers: {data.uniqueProposers}</p>
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
          <li>Economic Decentralization:
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Low Decentralization (Score &lt;34%): {stats.categoryPercentages.low.toFixed(1)}%</li>
              <li>Medium-Low (34-67%): {stats.categoryPercentages.mediumLow.toFixed(1)}%</li>
              <li>Medium (67-90%): {stats.categoryPercentages.medium.toFixed(1)}%</li>
              <li>Medium-High with Automation: {stats.categoryPercentages.mediumHigh.toFixed(1)}%</li>
              <li>High Decentralization (&gt;90%): {stats.categoryPercentages.high.toFixed(1)}%</li>
            </ul>
          </li>
          <li>Participation Distribution:
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Low Participation (&lt;10%): {stats.participation.lowPercent.toFixed(1)}%</li>
              <li>Medium Participation (10-40%): {(100 - stats.participation.lowPercent - stats.participation.highPercent).toFixed(1)}%</li>
              <li>High Participation (&gt;40%): {stats.participation.highPercent.toFixed(1)}%</li>
            </ul>
          </li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: The diagram uses inverted axes compared to the paper's definition, placing Decentralization Score 
          (100% - Largest Holder %) on the x-axis and Participation Rate on the y-axis for clearer visualization.
          Correlation between decentralization and participation is {
            Math.abs(stats.correlations.decentralizationParticipation) < 0.3 ? 'weak' :
            Math.abs(stats.correlations.decentralizationParticipation) < 0.7 ? 'moderate' : 'strong'
          } (ρ = {stats.correlations.decentralizationParticipation.toFixed(2)}). 
          The colored background regions correspond to the paper's KPI classification zones.
          {stats.automation.count} DAOs ({stats.automation.percent.toFixed(1)}%) implement on-chain automation,
          which positively impacts their governance effectiveness.
        </p>
      </div>
    </div>
  );
};

export default DecentralizationAnalysisImproved2;