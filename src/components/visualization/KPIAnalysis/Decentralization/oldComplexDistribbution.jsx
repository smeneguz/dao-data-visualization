import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Cell, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationDistributionimproved = () => {
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

  // Advanced statistical functions
  const calculateStatistics = (values) => {
    if (!values || values.length === 0) return null;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = _.mean(values);
    const variance = _.sumBy(values, v => Math.pow(v - mean, 2)) / n;
    const std = Math.sqrt(variance);
    
    // Calculate quantiles
    const quantile = (q) => {
      const idx = Math.floor(q * n);
      if (idx >= n) return sortedValues[n - 1];
      return sortedValues[idx];
    };
    
    const q1 = quantile(0.25);
    const median = quantile(0.5);
    const q3 = quantile(0.75);
    const iqr = q3 - q1;
    
    // Calculate skewness (Fisher's moment coefficient)
    const m3 = _.sum(values.map(v => Math.pow(v - mean, 3))) / n;
    const skewness = m3 / Math.pow(std, 3);
    
    // Calculate kurtosis (excess kurtosis)
    const m4 = _.sum(values.map(v => Math.pow(v - mean, 4))) / n;
    const kurtosis = (m4 / Math.pow(std, 4)) - 3;
    
    // Calculate optimal bandwidth for KDE using Scott's rule
    const bandwidth = 1.06 * std * Math.pow(n, -0.2);
    
    // Calculate goodness of fit for different distributions
    const fitMetrics = {
      normal: 1 - Math.min(1, Math.abs(skewness) + Math.abs(kurtosis)/2),
      logNormal: skewness > 0.5 ? 1 - Math.min(1, Math.abs(skewness - 0.6)/2) : 0.5 - skewness,
      uniform: 1 - Math.min(1, Math.abs(skewness) + Math.abs(kurtosis + 1.2))
    };
    
    // Determine best fit distribution
    const bestFit = Object.entries(fitMetrics)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
      n,
      mean,
      median,
      mode: getBinWithHighestFrequency(values),
      std,
      variance,
      q1,
      q3,
      iqr,
      min: Math.min(...values),
      max: Math.max(...values),
      skewness,
      kurtosis,
      normalityIndex: 1 / (1 + Math.abs(skewness) + Math.abs(kurtosis/2)),
      bandwidth,
      bestFit,
      fitMetrics
    };
  };
  
  // Helper function to get mode from binned data
  const getBinWithHighestFrequency = (values, binCount = 20) => {
    if (!values || values.length === 0) return 0;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / binCount;
    
    const bins = Array(binCount).fill(0);
    values.forEach(v => {
      const binIndex = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      bins[binIndex]++;
    });
    
    const maxBinIndex = bins.indexOf(Math.max(...bins));
    return min + (maxBinIndex + 0.5) * binWidth;
  };

  // Calculate Kernel Density Estimation (KDE)
  const calculateKDE = (values, points = 100, bandwidth = null) => {
    if (!values || values.length === 0) return [];
    
    const n = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Use Scott's rule for bandwidth if not provided
    const bw = bandwidth || (1.06 * Math.sqrt(_.variance(values)) * Math.pow(n, -0.2));
    
    const kde = [];
    for (let i = 0; i < points; i++) {
      const x = min + (i / (points - 1)) * (max - min);
      let y = 0;
      
      for (let j = 0; j < n; j++) {
        const z = (x - values[j]) / bw;
        y += Math.exp(-0.5 * z * z) / (bw * Math.sqrt(2 * Math.PI));
      }
      
      y /= n;
      kde.push({ x, y });
    }
    
    return kde;
  };

  // Calculate binned histogram with consistent bin width
  const createHistogram = (values, binCount = 10) => {
    if (!values || values.length === 0) return [];
    
    // Use threshold-aligned bin edges for better interpretation
    const binEdges = [0, 10, 20, 30, 33, 40, 50, 60, 66, 75, 85, 100];
    const bins = Array(binEdges.length - 1).fill(0).map((_, i) => ({
      binStart: binEdges[i],
      binEnd: binEdges[i + 1],
      count: 0,
      daos: []
    }));
    
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
    
    // Calculate frequencies and labels
    const n = values.length;
    return bins.map(bin => ({
      ...bin,
      binLabel: `${bin.binStart}-${bin.binEnd}%`,
      frequency: (bin.count / n) * 100,
      width: bin.binEnd - bin.binStart
    }));
  };
  
  // Fit parametric distributions
  const fitDistribution = (values, stats, type = 'normal', points = 100) => {
    if (!values || values.length === 0) return [];
    
    const { mean, std, min, max } = stats;
    const result = [];
    
    for (let i = 0; i < points; i++) {
      const x = min + (i / (points - 1)) * (max - min);
      let density = 0;
      
      if (type === 'normal') {
        // Normal distribution PDF
        const z = (x - mean) / std;
        density = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
      } else if (type === 'uniform') {
        // Uniform distribution PDF
        density = (x >= min && x <= max) ? 1 / (max - min) : 0;
      } else if (type === 'logNormal') {
        // Log-normal approximation (simplified)
        if (x > 0) {
          const logX = Math.log(x);
          const logMean = Math.log(mean) - 0.5 * Math.log(1 + (std/mean)**2);
          const logStd = Math.sqrt(Math.log(1 + (std/mean)**2));
          const z = (logX - logMean) / logStd;
          density = Math.exp(-0.5 * z * z) / (x * logStd * Math.sqrt(2 * Math.PI));
        }
      }
      
      result.push({ x, density });
    }
    
    return result;
  };

  // Interpret distribution shape
  const interpretDistribution = (stats) => {
    if (!stats || !stats.largestHolder) return '';
    
    const { skewness, kurtosis, normalityIndex, bestFit } = stats.largestHolder;
    
    let shapeDescription = "approximately symmetric";
    if (Math.abs(skewness) >= 0.5) {
      shapeDescription = skewness > 0 ? 
        "positively skewed (right-tailed)" : 
        "negatively skewed (left-tailed)";
    }
    
    let tailDescription = "mesokurtic (normal tails)";
    if (Math.abs(kurtosis) >= 0.5) {
      tailDescription = kurtosis > 0 ? 
        "leptokurtic (heavy-tailed)" : 
        "platykurtic (light-tailed)";
    }
    
    let distributionType = "normal distribution";
    if (bestFit === 'logNormal') {
      distributionType = "log-normal distribution";
    } else if (bestFit === 'uniform') {
      distributionType = "uniform distribution";
    }
    
    let normalityDescription = "closely follows a";
    if (normalityIndex < 0.7) {
      normalityDescription = "deviates significantly from a";
    } else if (normalityIndex < 0.9) {
      normalityDescription = "moderately approximates a";
    }
    
    return `${shapeDescription}, ${tailDescription}, and ${normalityDescription} ${distributionType}`;
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
        const largestHolderValues = processedData.map(d => d.largestHolder);
        const largestHolderStats = calculateStatistics(largestHolderValues);
        
        // Create histogram with consistent bins
        const histogramData = createHistogram(largestHolderValues);
        
        // Calculate KDE for visualization
        const kdeData = calculateKDE(largestHolderValues, 100, largestHolderStats.bandwidth);
        
        // Scale KDE to match histogram height for visualization
        const maxFreq = Math.max(...histogramData.map(d => d.frequency));
        const maxDensity = Math.max(...kdeData.map(d => d.y));
        const scaleFactor = maxFreq / maxDensity;
        
        const scaledKde = kdeData.map(point => ({
          x: point.x,
          density: point.y * scaleFactor
        }));
        
        // Combine histogram and KDE for visualization
        const combinedData = histogramData.map(bin => {
          const midpoint = (bin.binStart + bin.binEnd) / 2;
          const kdePoint = scaledKde.find(p => Math.abs(p.x - midpoint) < 2);
          
          return {
            ...bin,
            kdeValue: kdePoint ? kdePoint.density : 0
          };
        });
        
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
        
        // Prepare best-fit distribution data for visualization
        const bestFitType = largestHolderStats.bestFit;
        const bestFitData = fitDistribution(largestHolderValues, largestHolderStats, bestFitType, 100);
        
        // Scale best-fit distribution to match histogram
        const maxBestFitDensity = Math.max(...bestFitData.map(d => d.density));
        const bestFitScaleFactor = maxFreq / maxBestFitDensity;
        
        const scaledBestFit = bestFitData.map(point => ({
          x: point.x,
          y: point.density * bestFitScaleFactor
        }));
        
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
        
        // Prepare data for two-sample Kolmogorov-Smirnov test (simplified)
        // Compare distribution of automated vs. non-automated DAOs
        const automatedValues = processedData
          .filter(d => d.automated)
          .map(d => d.largestHolder);
          
        const nonAutomatedValues = processedData
          .filter(d => !d.automated)
          .map(d => d.largestHolder);
          
        const automatedStats = automatedValues.length > 0 ? calculateStatistics(automatedValues) : null;
        const nonAutomatedStats = nonAutomatedValues.length > 0 ? calculateStatistics(nonAutomatedValues) : null;
        
        // Calculate D statistic (maximum difference between the two ECDFs)
        let maxDiff = 0;
        
        if (automatedValues.length > 0 && nonAutomatedValues.length > 0) {
          const automatedEcdf = [...automatedValues].sort((a, b) => a - b)
            .map((v, i) => ({ value: v, cdf: (i + 1) / automatedValues.length }));
          
          const nonAutomatedEcdf = [...nonAutomatedValues].sort((a, b) => a - b)
            .map((v, i) => ({ value: v, cdf: (i + 1) / nonAutomatedValues.length }));
          
          // Merge and sort all unique values
          const allValues = [...new Set([...automatedValues, ...nonAutomatedValues])].sort((a, b) => a - b);
          
          // Calculate ECDF values at each point
          allValues.forEach(v => {
            const automatedCdf = automatedEcdf.find(p => p.value >= v)?.cdf || 0;
            const nonAutomatedCdf = nonAutomatedEcdf.find(p => p.value >= v)?.cdf || 0;
            const diff = Math.abs(automatedCdf - nonAutomatedCdf);
            if (diff > maxDiff) maxDiff = diff;
          });
        }
        
        // Set significance threshold (simplified)
        const significanceThreshold = 1.36 * Math.sqrt((automatedValues.length + nonAutomatedValues.length) / 
                                                       (automatedValues.length * nonAutomatedValues.length));
        
        const automationAnalysis = {
          ksStat: maxDiff,
          significant: maxDiff > significanceThreshold,
          automatedMean: automatedStats?.mean || 0,
          nonAutomatedMean: nonAutomatedStats?.mean || 0,
          meanDifference: (automatedStats?.mean || 0) - (nonAutomatedStats?.mean || 0)
        };
        
        setData({
          histogram: combinedData,
          kde: scaledKde,
          bestFit: scaledBestFit,
          bestFitType,
          categories: categoryData,
          daos: processedData
        });
        
        setStats({
          n: processedData.length,
          largestHolder: largestHolderStats,
          automation,
          proposer: proposerStats,
          automationAnalysis
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
          Figure 6: Distribution Analysis of Economic Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution of largest token holder percentages with fitted curve (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Largest Holder: μ = {stats.largestHolder.mean.toFixed(1)}% 
          (Median: {stats.largestHolder.median.toFixed(1)}%, Mode: {stats.largestHolder.mode.toFixed(1)}%, 
          IQR: {stats.largestHolder.q1.toFixed(1)}-{stats.largestHolder.q3.toFixed(1)}%)
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Distribution Shape: Skewness = {stats.largestHolder.skewness.toFixed(2)}, 
          Kurtosis = {stats.largestHolder.kurtosis.toFixed(2)}, 
          Normality Index = {stats.largestHolder.normalityIndex.toFixed(2)}
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

            {/* Central tendency reference line */}
            <ReferenceLine
              x={`${Math.floor(stats.largestHolder.median / 10) * 10}-${Math.ceil(stats.largestHolder.median / 10) * 10}%`}
              stroke="#666666"
              strokeDasharray="5 5"
              label={{
                value: `Median (${stats.largestHolder.median.toFixed(1)}%)`,
                position: "insideBottomLeft",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#666666' }
              }}
            />

            {/* Histogram Bars */}
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

            {/* Best Fit Distribution Line */}
            <Line
              type="monotone"
              data={data.bestFit.map(p => ({ ...p, binStart: p.x }))}
              dataKey="y"
              stroke="#000000"
              strokeWidth={2}
              dot={false}
              name={`Best Fit (${data.bestFitType})`}
            />

            {/* KDE Line */}
            <Line
              type="monotone"
              data={data.kde.map(p => ({ ...p, binStart: p.x }))}
              dataKey="density"
              stroke="#ff0000"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Kernel Density Estimation"
            />

            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px', fontFamily: 'serif' }}
            />

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
            <p style={{ marginTop: '15px', fontWeight: 'bold' }}>Distributional Properties:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li>Shape: {stats.largestHolder.skewness > 0.5 ? 'Right-skewed' : 
                          stats.largestHolder.skewness < -0.5 ? 'Left-skewed' : 
                          'Approximately symmetric'}</li>
              <li>Tails: {stats.largestHolder.kurtosis > 0.5 ? 'Heavier than normal' : 
                          stats.largestHolder.kurtosis < -0.5 ? 'Lighter than normal' : 
                          'Normal'}</li>
              <li>Best fitted distribution: {data.bestFitType.charAt(0).toUpperCase() + data.bestFitType.slice(1)}</li>
              <li>Goodness of fit: {(stats.largestHolder.fitMetrics[data.bestFitType] * 100).toFixed(1)}%</li>
            </ul>
          </div>
          <div style={{ width: '48%' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Statistical Insights:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li>Central Tendency: {
                stats.largestHolder.mean < stats.largestHolder.median ? 
                  'Left-skewed distribution (mean < median)' :
                  stats.largestHolder.mean > stats.largestHolder.median ?
                  'Right-skewed distribution (mean > median)' :
                  'Symmetric distribution (mean ≈ median)'
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
              {stats.automationAnalysis && (
                <li>Automation Analysis: {
                  stats.automationAnalysis.significant ?
                  `Significant difference between automated and non-automated DAOs (${Math.abs(stats.automationAnalysis.meanDifference).toFixed(1)}% mean difference)` :
                  'No significant difference between automated and non-automated DAOs'
                }</li>
              )}
            </ul>
          </div>
        </div>
        <p style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '11px' }}>
          <strong>Methodology note:</strong> This enhanced visualization presents a distribution analysis of largest token holder 
          percentages across the analyzed DAOs. The histogram uses consistent bin widths aligned with KPI thresholds (10%, 33%, 66%) 
          for better interpretability. The red dashed line shows the Kernel Density Estimation (KDE) with bandwidth = 
          {stats.largestHolder.bandwidth.toFixed(2)} calculated using Scott's rule, while the solid black line represents 
          the best-fitting {data.bestFitType} distribution based on statistical tests. The distribution is {interpretDistribution(stats)}, 
          providing valuable context for evaluating the current threshold values in the decentralization KPI framework.
        </p>
        <p style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '11px' }}>
          Statistical analysis suggests that DAOs in the dataset show a {
            data.categories.find(c => c.category === 'Medium/Medium-High').percentage > 40 ?
            'tendency toward medium decentralization' :
            data.categories.find(c => c.category === 'Medium-Low').percentage > 40 ?
            'tendency toward medium-low decentralization' :
            'varied distribution across decentralization categories'
          }, with a notable {
            stats.automation.percentage > 75 ? 'high' :
            stats.automation.percentage > 50 ? 'moderate' : 'low'
          } adoption of on-chain automation ({stats.automation.percentage.toFixed(1)}% of DAOs). {
            stats.automationAnalysis && stats.automationAnalysis.significant ?
            `Automated DAOs show ${stats.automationAnalysis.meanDifference < 0 ? 'lower' : 'higher'} largest holder percentages on average, suggesting a relationship between automation and decentralization.` :
            'There is no statistically significant relationship between automation and largest holder percentages in the current dataset.'
          }
        </p>
      </div>
    </div>
  );
};

export default DecentralizationDistributionimproved;

