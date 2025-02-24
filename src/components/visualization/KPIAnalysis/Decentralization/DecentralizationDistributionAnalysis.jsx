import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Cell } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationDistributionAnalysis = () => {
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
      exportToPNG({ current: svgElement }, 'decentralization_distribution', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'decentralization_distribution');
    }
  };

  // Calculate statistics for largest holder distribution
  const calculateStatistics = (values) => {
    const sortedValues = [...values].sort((a, b) => a - b);
    const mean = _.mean(values);
    const std = Math.sqrt(_.sumBy(values, v => Math.pow(v - mean, 2)) / (values.length - 1));
    
    // Calculate quantiles
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const median = sortedValues[Math.floor(sortedValues.length * 0.5)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = q3 - q1;
    
    // Calculate skewness
    const skewness = _.sum(values.map(v => Math.pow((v - mean) / std, 3))) / values.length;
    
    // Calculate kurtosis
    const kurtosis = _.sum(values.map(v => Math.pow((v - mean) / std, 4))) / values.length - 3;
    
    return {
      mean,
      median,
      std,
      q1,
      q3,
      iqr,
      skewness,
      kurtosis,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  useEffect(() => {
    const analyzeDecentralization = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process data
        const processedData = jsonData
          .map(dao => {
            if (!dao || !dao.decentralisation) return null;
            
            return {
              name: dao.dao_name,
              largestHolder: dao.decentralisation.largest_holder_percent,
              automated: dao.decentralisation.on_chain_automation === 'Yes',
              distribution: dao.decentralisation.token_distribution || {},
              proposerConcentration: dao.decentralisation.proposer_concentration
            };
          })
          .filter(d => d !== null && !isNaN(d.largestHolder) && d.largestHolder >= 0 && d.largestHolder <= 100);

        // Calculate statistics for largest holder
        const largestHolderStats = calculateStatistics(processedData.map(d => d.largestHolder));
        
        // Create histogram data
        const createHistogram = (values, binCount = 10) => {
          const min = Math.min(...values);
          const max = Math.max(...values);
          const binWidth = (max - min) / binCount;
          
          const bins = Array(binCount).fill(0).map((_, i) => ({
            binStart: min + i * binWidth,
            binEnd: min + (i + 1) * binWidth,
            count: 0,
            daos: []
          }));
          
          values.forEach((value, index) => {
            const binIndex = Math.min(binCount - 1, Math.floor((value - min) / binWidth));
            bins[binIndex].count++;
            bins[binIndex].daos.push(index);
          });
          
          return bins.map(bin => ({
            ...bin,
            binLabel: `${bin.binStart.toFixed(0)}-${bin.binEnd.toFixed(0)}%`,
            frequency: (bin.count / values.length) * 100
          }));
        };
        
        // Generate histogram data for largest holder percentage
        const histogramData = createHistogram(processedData.map(d => d.largestHolder), 10);
        
        // Categorize DAOs by decentralization level based on paper thresholds
        const categorizeDAO = (largestHolder) => {
          if (largestHolder > 66) return 'Low';
          if (largestHolder > 33) return 'Medium-Low';
          if (largestHolder > 10) return 'Medium/Medium-High';
          return 'High';
        };
        
        const categoryData = [
          { category: 'Low', threshold: '>66%', count: 0, color: '#d32f2f' },
          { category: 'Medium-Low', threshold: '33-66%', count: 0, color: '#f57c00' },
          { category: 'Medium/Medium-High', threshold: '10-33%', count: 0, color: '#7cb342' },
          { category: 'High', threshold: '<10%', count: 0, color: '#1b5e20' }
        ];
        
        processedData.forEach(dao => {
          const category = categorizeDAO(dao.largestHolder);
          const categoryItem = categoryData.find(c => c.category === category);
          if (categoryItem) categoryItem.count++;
        });
        
        // Calculate percentages
        categoryData.forEach(item => {
          item.percentage = (item.count / processedData.length) * 100;
        });
        
        // Get automation statistics
        const automation = {
          count: processedData.filter(d => d.automated).length,
          percentage: (processedData.filter(d => d.automated).length / processedData.length) * 100
        };
        
        // Analyze proposer concentration where available
        const proposerData = processedData
          .filter(d => d.proposerConcentration !== undefined && !isNaN(d.proposerConcentration))
          .map(d => d.proposerConcentration);
          
        const proposerStats = proposerData.length > 0 ? calculateStatistics(proposerData) : null;
        
        setData({
          histogram: histogramData,
          categories: categoryData,
          daos: processedData
        });
        
        setStats({
          n: processedData.length,
          largestHolder: largestHolderStats,
          automation,
          proposer: proposerStats
        });
        
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
          Figure 2: Distribution Analysis of Economic Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution of largest token holder percentages (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Largest Holder: μ = {stats.largestHolder.mean.toFixed(1)}% 
          (Median: {stats.largestHolder.median.toFixed(1)}%, IQR: {stats.largestHolder.q1.toFixed(1)}-{stats.largestHolder.q3.toFixed(1)}%)
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Distribution Shape: Skewness = {stats.largestHolder.skewness.toFixed(2)}, 
          Kurtosis = {stats.largestHolder.kurtosis.toFixed(2)}
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <BarChart
            data={data.histogram}
            margin={{ top: 20, right: 50, bottom: 60, left: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="binLabel"
              tick={{ fontFamily: 'serif', fontSize: '11px' }}
            >
              <Label
                value="Largest Token Holder Percentage (%)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              label={{ 
                value: 'Frequency (%)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { fontFamily: 'serif', fontSize: '12px' } 
              }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />

            {/* Decentralization threshold lines */}
            <ReferenceLine
              x="10-20%"
              stroke="#388e3c"
              strokeDasharray="3 3"
              label={{
                value: "High Threshold",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#388e3c' }
              }}
            />
            <ReferenceLine
              x="30-40%"
              stroke="#f57c00"
              strokeDasharray="3 3"
              label={{
                value: "Medium Threshold",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#f57c00' }
              }}
            />
            <ReferenceLine
              x="60-70%"
              stroke="#d32f2f"
              strokeDasharray="3 3"
              label={{
                value: "Low Threshold",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#d32f2f' }
              }}
            />

            <Bar dataKey="frequency" name="Frequency">
              {data.histogram.map((entry, index) => {
                // Color bars based on which category they fall into
                let color = '#1b5e20'; // Default to high decentralization color
                
                if (entry.binStart >= 66) {
                  color = '#d32f2f'; // Low decentralization
                } else if (entry.binStart >= 33) {
                  color = '#f57c00'; // Medium-Low decentralization
                } else if (entry.binStart >= 10) {
                  color = '#7cb342'; // Medium decentralization
                }
                
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>

            <Tooltip
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
                      <p style={{ fontWeight: 'bold' }}>{data.binLabel} Range</p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count} DAOs</p>
                      <p>Decentralization Level: {
                        data.binStart >= 66 ? 'Low' :
                        data.binStart >= 33 ? 'Medium-Low' :
                        data.binStart >= 10 ? 'Medium/Medium-High' : 'High'
                      }</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <div style={{ width: '48%' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Distribution Analysis:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              {data.categories.map((category, index) => (
                <li key={index} style={{ marginBottom: '5px' }}>
                  <span style={{ color: category.color, fontWeight: 'bold' }}>{category.category}</span> Decentralization ({category.threshold}): 
                  {' '}{category.count} DAOs ({category.percentage.toFixed(1)}%)
                </li>
              ))}
            </ul>
          </div>
          <div style={{ width: '48%' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Statistical Insights:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li>Distribution Shape: {
                Math.abs(stats.largestHolder.skewness) < 0.5 ? 'Approximately symmetric' :
                stats.largestHolder.skewness > 0 ? 'Positively skewed (right tail)' : 'Negatively skewed (left tail)'
              }</li>
              <li>Primary Concentration: {
                stats.largestHolder.median < 33 ? 'Most DAOs show relatively balanced token distribution' :
                stats.largestHolder.median > 50 ? 'Majority of DAOs have significant token concentration' :
                'DAOs show moderate token concentration'
              }</li>
              <li>On-chain Automation: {stats.automation.count} DAOs ({stats.automation.percentage.toFixed(1)}%)</li>
              {stats.proposer && (
                <li>Proposer Concentration: Mean {stats.proposer.mean.toFixed(1)}% 
                  (Range: {stats.proposer.min.toFixed(1)}-{stats.proposer.max.toFixed(1)}%)
                </li>
              )}
            </ul>
          </div>
        </div>
        <p style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '11px' }}>
          <strong>Methodology note:</strong> This histogram shows the distribution of largest token holder percentages 
          across the analyzed DAOs. The colored bars represent the decentralization categories defined in the KPI framework, 
          with darker greens indicating higher decentralization (lower largest holder percentages). The 
          statistical analysis indicates that the distribution is {
            Math.abs(stats.largestHolder.skewness) < 0.5 ? 'approximately symmetric' :
            stats.largestHolder.skewness > 0 ? 'right-skewed' : 'left-skewed'
          } with {
            Math.abs(stats.largestHolder.kurtosis) < 0.5 ? 'normal tails' :
            stats.largestHolder.kurtosis > 0 ? 'heavier-than-normal tails (leptokurtic)' : 'lighter-than-normal tails (platykurtic)'
          }, suggesting {
            Math.abs(stats.largestHolder.skewness) < 0.5 && Math.abs(stats.largestHolder.kurtosis) < 0.5 ? 
            'a relatively balanced distribution of decentralization across the ecosystem' :
            stats.largestHolder.skewness > 0 ? 
            'a tendency toward centralization with some highly decentralized outliers' :
            'a tendency toward decentralization with some highly centralized outliers'
          }.
        </p>
      </div>
    </div>
  );
};

export default DecentralizationDistributionAnalysis;