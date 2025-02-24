import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Cell, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizeDistributionImproved = () => {
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

  // Calculate basic statistics
  const calculateBasicStats = (values) => {
    if (!values || values.length === 0) return null;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = _.mean(values);
    const variance = _.sumBy(values, v => Math.pow(v - mean, 2)) / (n - 1);
    const std = Math.sqrt(variance);
    
    // Calculate quantiles
    const q1Index = Math.floor(n * 0.25);
    const medianIndex = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    return {
      n,
      mean,
      median: sortedValues[medianIndex],
      q1: sortedValues[q1Index],
      q3: sortedValues[q3Index],
      std,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  // Calculate histogram with consistent bins
  const createHistogram = (values) => {
    if (!values || values.length === 0) return [];
    
    // Aligned bin edges for better interpretation
    // Based on paper's thresholds: 10%, 33%, 66%
    const binEdges = [0, 10, 20, 30, 33, 40, 50, 60, 66, 75, 85, 100];
    
    const bins = [];
    for (let i = 0; i < binEdges.length - 1; i++) {
      bins.push({
        binStart: binEdges[i],
        binEnd: binEdges[i + 1],
        binLabel: `${binEdges[i]}-${binEdges[i + 1]}%`,
        count: 0,
        daos: []
      });
    }
    
    // Count values in each bin
    values.forEach((value, index) => {
      for (let i = 0; i < bins.length; i++) {
        if (value >= bins[i].binStart && value < bins[i].binEnd) {
          bins[i].count++;
          bins[i].daos.push(index);
          break;
        }
        // Handle the last bin edge case
        if (i === bins.length - 1 && value === bins[i].binEnd) {
          bins[i].count++;
          bins[i].daos.push(index);
        }
      }
    });
    
    // Calculate frequencies
    const n = values.length;
    return bins.map(bin => ({
      ...bin,
      frequency: (bin.count / n) * 100
    }));
  };

  useEffect(() => {
    const analyzeDecentralization = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process data with validation
        const processedData = jsonData
          .map(dao => {
            if (!dao || !dao.decentralisation) return null;
            
            return {
              name: dao.dao_name,
              largestHolder: dao.decentralisation.largest_holder_percent,
              automated: dao.decentralisation.on_chain_automation === 'Yes',
              proposerConcentration: dao.decentralisation.proposer_concentration
            };
          })
          .filter(d => d !== null && !isNaN(d.largestHolder) && d.largestHolder >= 0 && d.largestHolder <= 100);

        // Calculate statistics
        const largestHolderValues = processedData.map(d => d.largestHolder);
        const largestHolderStats = calculateBasicStats(largestHolderValues);
        
        // Create histogram
        const histogramData = createHistogram(largestHolderValues);
        
        // Categorize DAOs by paper thresholds
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
        const automationCount = processedData.filter(d => d.automated).length;
        const automationPercentage = (automationCount / processedData.length) * 100;
        
        // Analyze proposer concentration where available
        const proposerData = processedData
          .filter(d => d.proposerConcentration !== undefined && !isNaN(d.proposerConcentration))
          .map(d => d.proposerConcentration);
          
        const proposerStats = proposerData.length > 0 ? calculateBasicStats(proposerData) : null;
        
        setData({
          histogram: histogramData,
          categories: categoryData,
          daos: processedData
        });
        
        setStats({
          n: processedData.length,
          largestHolder: largestHolderStats,
          automation: {
            count: automationCount,
            percentage: automationPercentage
          },
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
          Figure 2.1: Distribution Analysis of Economic Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution of largest token holder percentages (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Largest Holder: μ = {stats.largestHolder.mean.toFixed(1)}% 
          (Median: {stats.largestHolder.median.toFixed(1)}%, 
          IQR: {stats.largestHolder.q1.toFixed(1)}-{stats.largestHolder.q3.toFixed(1)}%)
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ComposedChart
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

            {/* Category background areas */}
            <ReferenceArea x1="0-10%" x2="10-20%" fill="#e8f5e9" fillOpacity={0.4} />
            <ReferenceArea x1="10-20%" x2="30-33%" fill="#c8e6c9" fillOpacity={0.4} />
            <ReferenceArea x1="33-40%" x2="60-66%" fill="#ffe0b2" fillOpacity={0.4} />
            <ReferenceArea x1="66-75%" x2="85-100%" fill="#ffcdd2" fillOpacity={0.4} />

            {/* Decentralization threshold lines */}
            <ReferenceLine
              x="0-10%"
              stroke="#388e3c"
              strokeDasharray="3 3"
              label={{
                value: "High Threshold (10%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#388e3c' }
              }}
            />
            <ReferenceLine
              x="30-33%"
              stroke="#f57c00"
              strokeDasharray="3 3"
              label={{
                value: "Medium Threshold (33%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#f57c00' }
              }}
            />
            <ReferenceLine
              x="60-66%"
              stroke="#d32f2f"
              strokeDasharray="3 3"
              label={{
                value: "Low Threshold (66%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#d32f2f' }
              }}
            />

            {/* Histogram Bars */}
            <Bar dataKey="frequency" name="Frequency">
              {data.histogram.map((entry, index) => {
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
          </ComposedChart>
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
              <li>Central Tendency: {
                Math.abs(stats.largestHolder.mean - stats.largestHolder.median) < 5 ?
                  'Symmetric distribution (mean ≈ median)' :
                stats.largestHolder.mean < stats.largestHolder.median ? 
                  'Left-skewed distribution (mean < median)' :
                  'Right-skewed distribution (mean > median)'
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
          <strong>Methodology note:</strong> This visualization presents a distribution analysis of largest token holder 
          percentages across the analyzed DAOs. The histogram uses consistent bin widths aligned with KPI thresholds (10%, 33%, 66%) 
          for better interpretability. Color-coded background areas indicate different decentralization categories from the paper's framework.
          The distribution shows that {
            data.categories.find(c => c.category === 'Medium/Medium-High').percentage > 40 ?
            'most DAOs fall in the medium decentralization range (10-33% largest holder)' :
            data.categories.find(c => c.category === 'Medium-Low').percentage > 40 ?
            'most DAOs fall in the medium-low decentralization range (33-66% largest holder)' :
            'DAOs are distributed across different decentralization categories'
          }, providing valuable context for evaluating the current threshold values.
        </p>
        <p style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '11px' }}>
          The data reveals a {
            stats.automation.percentage > 75 ? 'high' :
            stats.automation.percentage > 50 ? 'moderate' : 'low'
          } adoption of on-chain automation ({stats.automation.percentage.toFixed(1)}% of DAOs), which
          is a key factor in achieving higher decentralization scores according to the KPI framework. This distribution analysis
          complements the scatter plot visualization by providing a broader view of how DAOs are distributed across the
          decentralization spectrum defined in the paper.
        </p>
      </div>
    </div>
  );
};

export default DecentralizeDistributionImproved;