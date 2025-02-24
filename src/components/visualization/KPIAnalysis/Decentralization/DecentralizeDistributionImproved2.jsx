import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Legend, Cell, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const FinalDecentralizationDistribution = () => {
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

  // Safe access function to avoid undefined errors
  const safeAccess = (obj, path, defaultValue) => {
    try {
      const result = path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
      return result !== undefined ? result : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // Safe number formatting
  const safeFixed = (number, decimals = 1) => {
    if (number === undefined || number === null || isNaN(number)) return '0.0';
    return number.toFixed(decimals);
  };

  // Advanced statistical functions with safety checks
  const calculateStatistics = (values) => {
    if (!values || !Array.isArray(values) || values.length === 0) {
      return {
        n: 0,
        mean: 0,
        median: 0,
        mode: 0,
        std: 0,
        variance: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        min: 0,
        max: 0,
        skewness: 0,
        kurtosis: 0,
        normalityIndex: 0.5,
        bandwidth: 1,
        bestFit: 'normal',
        fitMetrics: { normal: 1, logNormal: 0, uniform: 0 }
      };
    }
    
    // Filter out any non-numeric values
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) {
      return {
        n: 0,
        mean: 0,
        median: 0,
        mode: 0,
        std: 0,
        variance: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        min: 0,
        max: 0,
        skewness: 0,
        kurtosis: 0,
        normalityIndex: 0.5,
        bandwidth: 1,
        bestFit: 'normal',
        fitMetrics: { normal: 1, logNormal: 0, uniform: 0 }
      };
    }
    
    const sortedValues = [...validValues].sort((a, b) => a - b);
    const n = validValues.length;
    const mean = _.mean(validValues);
    const variance = _.sumBy(validValues, v => Math.pow(v - mean, 2)) / (n - 1);
    const std = Math.sqrt(variance);
    
    // Calculate quantiles safely
    const quantile = (q) => {
      const idx = Math.floor(q * n);
      if (idx >= n) return sortedValues[n - 1];
      if (idx < 0) return sortedValues[0];
      return sortedValues[idx];
    };
    
    const q1 = quantile(0.25);
    const median = quantile(0.5);
    const q3 = quantile(0.75);
    const iqr = q3 - q1;
    
    // Safely calculate skewness and kurtosis
    let skewness = 0;
    let kurtosis = 0;
    
    // Only calculate if we have enough data points and std is not 0
    if (n > 2 && std > 0) {
      // Calculate skewness (Fisher's moment coefficient)
      const m3 = _.sum(validValues.map(v => Math.pow(v - mean, 3))) / n;
      skewness = m3 / Math.pow(std, 3);
      
      // Calculate kurtosis (excess kurtosis)
      const m4 = _.sum(validValues.map(v => Math.pow(v - mean, 4))) / n;
      kurtosis = (m4 / Math.pow(std, 4)) - 3;
    }
    
    // Calculate optimal bandwidth for KDE using Scott's rule with safety check
    const bandwidth = (n > 1 && std > 0) ? 1.06 * std * Math.pow(n, -0.2) : 1;
    
    // Calculate goodness of fit for different distributions
    const fitMetrics = {
      normal: 1 - Math.min(1, Math.abs(skewness) + Math.abs(kurtosis)/2),
      logNormal: skewness > 0.5 ? 1 - Math.min(1, Math.abs(skewness - 0.6)/2) : 0.5 - skewness,
      uniform: 1 - Math.min(1, Math.abs(skewness) + Math.abs(kurtosis + 1.2))
    };
    
    // Determine best fit distribution
    const bestFitEntries = Object.entries(fitMetrics).sort((a, b) => b[1] - a[1]);
    const bestFit = bestFitEntries.length > 0 ? bestFitEntries[0][0] : 'normal';
    
    return {
      n,
      mean,
      median,
      mode: getBinWithHighestFrequency(validValues),
      std,
      variance,
      q1,
      q3,
      iqr,
      min: Math.min(...validValues),
      max: Math.max(...validValues),
      skewness,
      kurtosis,
      normalityIndex: 1 / (1 + Math.abs(skewness) + Math.abs(kurtosis)/2),
      bandwidth,
      bestFit,
      fitMetrics
    };
  };
  
  // Helper function to get mode from binned data with safety checks
  const getBinWithHighestFrequency = (values, binCount = 20) => {
    if (!values || !Array.isArray(values) || values.length === 0) return 0;
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return 0;
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    
    // If min equals max, return that value
    if (min === max) return min;
    
    const binWidth = (max - min) / binCount;
    
    // If binWidth is too small, return median
    if (binWidth < 0.00001) {
      return validValues[Math.floor(validValues.length / 2)];
    }
    
    const bins = Array(binCount).fill(0);
    validValues.forEach(v => {
      const binIndex = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      if (binIndex >= 0 && binIndex < binCount) {
        bins[binIndex]++;
      }
    });
    
    const maxBinIndex = bins.indexOf(Math.max(...bins));
    return min + (maxBinIndex + 0.5) * binWidth;
  };

  // Calculate Kernel Density Estimation (KDE) with safety checks
  const calculateKDE = (values, points = 100, bandwidth = null) => {
    if (!values || !Array.isArray(values) || values.length === 0) return [];
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return [];
    
    const n = validValues.length;
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    
    // If min equals max, return a simple line at that point
    if (min === max) {
      return Array(points).fill(0).map((_, i) => ({ x: min, y: i === Math.floor(points/2) ? 1 : 0 }));
    }
    
    // Use Scott's rule for bandwidth if not provided or invalid
    const computedBandwidth = bandwidth || 1.06 * Math.sqrt(_.variance(validValues)) * Math.pow(n, -0.2);
    const bw = computedBandwidth > 0 ? computedBandwidth : 1;
    
    const kde = [];
    for (let i = 0; i < points; i++) {
      const x = min + (i / (points - 1)) * (max - min);
      let y = 0;
      
      for (let j = 0; j < n; j++) {
        const z = (x - validValues[j]) / bw;
        y += Math.exp(-0.5 * z * z) / (bw * Math.sqrt(2 * Math.PI));
      }
      
      y /= n;
      kde.push({ x, y });
    }
    
    return kde;
  };

  // Calculate binned histogram with consistent bin width and safety checks
  const createHistogram = (values) => {
    if (!values || !Array.isArray(values) || values.length === 0) return [];
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) return [];
    
    // Use threshold-aligned bin edges for better interpretation
    const binEdges = [0, 10, 20, 30, 33, 40, 50, 60, 66, 75, 85, 100];
    const bins = Array(binEdges.length - 1).fill(0).map((_, i) => ({
      binStart: binEdges[i],
      binEnd: binEdges[i + 1],
      count: 0,
      daos: []
    }));
    
    // Count values in each bin
    validValues.forEach((value, index) => {
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
    const n = validValues.length;
    return bins.map(bin => ({
      ...bin,
      binLabel: `${bin.binStart}-${bin.binEnd}%`,
      frequency: (bin.count / n) * 100,
      width: bin.binEnd - bin.binStart
    }));
  };
  
  // Fit parametric distributions with safety checks
  const fitDistribution = (values, stats, type = 'normal', points = 100) => {
    if (!values || !Array.isArray(values) || values.length === 0 || !stats) {
      return Array(points).fill({ x: 0, density: 0 });
    }
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) {
      return Array(points).fill({ x: 0, density: 0 });
    }
    
    const { mean, std, min, max } = stats;
    
    // Safety check
    if (isNaN(mean) || isNaN(std) || isNaN(min) || isNaN(max) || std <= 0 || min >= max) {
      return Array(points).fill({ x: 0, density: 0 });
    }
    
    const result = [];
    
    for (let i = 0; i < points; i++) {
      const x = min + (i / (points - 1)) * (max - min);
      let density = 0;
      
      try {
        if (type === 'normal') {
          // Normal distribution PDF
          const z = (x - mean) / std;
          density = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
        } else if (type === 'uniform') {
          // Uniform distribution PDF
          density = (x >= min && x <= max) ? 1 / (max - min) : 0;
        } else if (type === 'logNormal' && x > 0) {
          // Log-normal approximation (simplified)
          try {
            const logMean = Math.log(mean) - 0.5 * Math.log(1 + (std/mean)**2);
            const logStd = Math.sqrt(Math.log(1 + (std/mean)**2));
            const z = (Math.log(x) - logMean) / logStd;
            density = Math.exp(-0.5 * z * z) / (x * logStd * Math.sqrt(2 * Math.PI));
          } catch (e) {
            density = 0;
          }
        }
      } catch (e) {
        density = 0;
      }
      
      result.push({ x, density });
    }
    
    return result;
  };

  // Interpret distribution shape with safety checks
  const interpretDistribution = (stats) => {
    if (!stats || !stats.largestHolder) return 'a distribution that could not be analyzed';
    
    try {
      const { skewness, kurtosis, normalityIndex, bestFit } = stats.largestHolder;
      
      if (isNaN(skewness) || isNaN(kurtosis) || isNaN(normalityIndex)) {
        return 'a distribution with insufficient data for analysis';
      }
      
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
    } catch (e) {
      return 'a distribution that could not be fully analyzed';
    }
  };

  useEffect(() => {
    const analyzeDecentralization = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process data with thorough validation
        const processedData = jsonData
          .map(dao => {
            if (!dao || !dao.decentralisation) return null;
            
            return {
              name: dao.dao_name || 'Unknown DAO',
              largestHolder: parseFloat(dao.decentralisation.largest_holder_percent),
              automated: dao.decentralisation.on_chain_automation === 'Yes',
              distribution: dao.decentralisation.token_distribution || {},
              proposerConcentration: parseFloat(dao.decentralisation.proposer_concentration)
            };
          })
          .filter(d => d !== null && !isNaN(d.largestHolder) && d.largestHolder >= 0 && d.largestHolder <= 100);

        if (processedData.length === 0) {
          console.error('No valid data found after filtering');
          return;
        }

        // Calculate statistics for largest holder
        const largestHolderValues = processedData.map(d => d.largestHolder);
        const largestHolderStats = calculateStatistics(largestHolderValues);
        
        // Create histogram with consistent bins
        const histogramData = createHistogram(largestHolderValues);
        
        // Calculate KDE for visualization with safety checks
        let scaledKde = [];
        let scaledBestFit = [];
        
        try {
          const kdeData = calculateKDE(largestHolderValues, 100, largestHolderStats.bandwidth);
          
          // Scale KDE to match histogram height for visualization
          const maxFreq = Math.max(...histogramData.map(d => d.frequency));
          const maxDensity = Math.max(...kdeData.map(d => d.y));
          
          if (maxDensity > 0) {
            const scaleFactor = maxFreq / maxDensity;
            
            scaledKde = kdeData.map(point => ({
              x: point.x,
              density: point.y * scaleFactor
            }));
          }
          
          // Prepare best-fit distribution data for visualization
          const bestFitType = largestHolderStats.bestFit;
          const bestFitData = fitDistribution(largestHolderValues, largestHolderStats, bestFitType, 100);
          
          // Scale best-fit distribution to match histogram
          const maxBestFitDensity = Math.max(...bestFitData.map(d => d.density));
          
          if (maxBestFitDensity > 0) {
            const bestFitScaleFactor = maxFreq / maxBestFitDensity;
            
            scaledBestFit = bestFitData.map(point => ({
              x: point.x,
              y: point.density * bestFitScaleFactor
            }));
          }
        } catch (e) {
          console.error('Error calculating KDE or best fit:', e);
          // Continue with empty arrays for KDE and best fit
        }
        
        // Combine histogram and KDE for visualization with safety checks
        const combinedData = histogramData.map(bin => {
          const midpoint = (bin.binStart + bin.binEnd) / 2;
          let kdeValue = 0;
          
          try {
            const kdePoint = scaledKde.find(p => Math.abs(p.x - midpoint) < 2);
            if (kdePoint) kdeValue = kdePoint.density;
          } catch (e) {
            console.error('Error finding KDE point:', e);
          }
          
          return {
            ...bin,
            kdeValue
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
        
        // Calculate percentages with safety check
        categoryData.forEach(item => {
          item.percentage = (item.count / processedData.length) * 100;
        });
        
        // Get automation statistics
        const automationCount = processedData.filter(d => d.automated).length;
        const automationPercentage = (automationCount / processedData.length) * 100;
        
        // Analyze proposer concentration where available with safety checks
        let proposerStats = null;
        try {
          const proposerData = processedData
            .filter(d => d.proposerConcentration !== undefined && !isNaN(d.proposerConcentration))
            .map(d => d.proposerConcentration);
            
          if (proposerData.length > 0) {
            proposerStats = calculateStatistics(proposerData);
          }
        } catch (e) {
          console.error('Error calculating proposer stats:', e);
        }
        
        // Prepare data for two-sample Kolmogorov-Smirnov test (simplified) with safety checks
        let automationAnalysis = null;
        try {
          const automatedValues = processedData
            .filter(d => d.automated)
            .map(d => d.largestHolder);
            
          const nonAutomatedValues = processedData
            .filter(d => !d.automated)
            .map(d => d.largestHolder);
          
          if (automatedValues.length > 0 && nonAutomatedValues.length > 0) {
            const automatedStats = calculateStatistics(automatedValues);
            const nonAutomatedStats = calculateStatistics(nonAutomatedValues);
            
            // Calculate D statistic (maximum difference between the two ECDFs)
            let maxDiff = 0;
            
            const automatedEcdf = [...automatedValues].sort((a, b) => a - b)
              .map((v, i) => ({ value: v, cdf: (i + 1) / automatedValues.length }));
            
            const nonAutomatedEcdf = [...nonAutomatedValues].sort((a, b) => a - b)
              .map((v, i) => ({ value: v, cdf: (i + 1) / nonAutomatedValues.length }));
            
            // Merge and sort all unique values
            const allValues = [...new Set([...automatedValues, ...nonAutomatedValues])].sort((a, b) => a - b);
            
            // Calculate ECDF values at each point
            allValues.forEach(v => {
              let automatedCdf = 0;
              let nonAutomatedCdf = 0;
              
              try {
                const autoPoint = automatedEcdf.find(p => p.value >= v);
                if (autoPoint) automatedCdf = autoPoint.cdf;
              } catch (e) {}
              
              try {
                const nonAutoPoint = nonAutomatedEcdf.find(p => p.value >= v);
                if (nonAutoPoint) nonAutomatedCdf = nonAutoPoint.cdf;
              } catch (e) {}
              
              const diff = Math.abs(automatedCdf - nonAutomatedCdf);
              if (diff > maxDiff) maxDiff = diff;
            });
            
            // Set significance threshold (simplified)
            const significanceThreshold = 1.36 * Math.sqrt((automatedValues.length + nonAutomatedValues.length) / 
                                                           (automatedValues.length * nonAutomatedValues.length));
            
            automationAnalysis = {
              ksStat: maxDiff,
              significant: maxDiff > significanceThreshold,
              automatedMean: automatedStats.mean,
              nonAutomatedMean: nonAutomatedStats.mean,
              meanDifference: automatedStats.mean - nonAutomatedStats.mean
            };
          }
        } catch (e) {
          console.error('Error calculating automation analysis:', e);
        }
        
        // Set data states with safety checks
        setData({
          histogram: combinedData,
          kde: scaledKde,
          bestFit: scaledBestFit,
          bestFitType: largestHolderStats.bestFit,
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

  // Function to safely find category percentage
  const getCategoryPercentage = (categoryName, defaultValue = 0) => {
    try {
      const category = data.categories.find(c => c.category === categoryName);
      return category ? category.percentage : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

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
          Figure 2.2: Distribution Analysis of Economic Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution of largest token holder percentages with fitted curve (N = {safeAccess(stats, 'n', 0)})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Largest Holder: μ = {safeFixed(safeAccess(stats, 'largestHolder.mean', 0))}% 
          (Median: {safeFixed(safeAccess(stats, 'largestHolder.median', 0))}%, 
          Mode: {safeFixed(safeAccess(stats, 'largestHolder.mode', 0))}%, 
          IQR: {safeFixed(safeAccess(stats, 'largestHolder.q1', 0))}-{safeFixed(safeAccess(stats, 'largestHolder.q3', 0))}%)
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Distribution Shape: Skewness = {safeFixed(safeAccess(stats, 'largestHolder.skewness', 0), 2)}, 
          Kurtosis = {safeFixed(safeAccess(stats, 'largestHolder.kurtosis', 0), 2)}, 
          Normality Index = {safeFixed(safeAccess(stats, 'largestHolder.normalityIndex', 0), 2)}
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
              tickFormatter={(value) => `${safeFixed(value, 0)}%`}
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
          
          export default FinalDecentralizationDistribution;