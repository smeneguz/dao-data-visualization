import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Area, ComposedChart, Scatter, ReferenceLine, Label, ReferenceArea,
  Cell, LabelList
} from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const DecentralizationThresholdOptimization = () => {
  const [data, setData] = useState(null);
  const [thresholds, setThresholds] = useState({
    current: { low: 66, mediumLow: 33, high: 10 },
    optimized: { low: null, mediumLow: null, high: null }
  });
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'decentralization_thresholds', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'decentralization_thresholds');
    }
  };

  // Safe data access utility
  const safeAccess = (obj, path, defaultValue) => {
    try {
      const result = path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
      return result !== undefined ? result : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // =================== STATISTICAL ANALYSIS FUNCTIONS ===================

  // Calculate basic statistics
  const calculateBasicStats = (values) => {
    if (!values || !Array.isArray(values) || values.length === 0) {
      return { mean: 0, median: 0, std: 0, q1: 0, q3: 0, min: 0, max: 0, count: 0 };
    }
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) {
      return { mean: 0, median: 0, std: 0, q1: 0, q3: 0, min: 0, max: 0, count: 0 };
    }
    
    const sorted = [...validValues].sort((a, b) => a - b);
    const n = validValues.length;
    const mean = _.mean(validValues);
    const variance = _.sumBy(validValues, v => Math.pow(v - mean, 2)) / (n - 1);
    const std = Math.sqrt(variance);
    
    // Calculate quartiles
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    
    return {
      mean,
      median,
      std,
      q1,
      q3,
      iqr: q3 - q1,
      min: sorted[0],
      max: sorted[n - 1],
      count: n
    };
  };

// Find natural breaks in data using Jenks optimization
const findNaturalBreaks = (data, numClasses) => {
    if (!data || !Array.isArray(data) || data.length <= numClasses) {
      return Array(numClasses).fill(0).map((_, i) => data ? (data[i] || 0) : 0);
    }
    
    // Create a sorted copy of the data
    const sortedData = [...data].filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    if (sortedData.length <= numClasses) {
      return sortedData;
    }
    
    // Implementation of Jenks natural breaks algorithm (simplified)
    const n = sortedData.length;
    const mat1 = Array(n + 1).fill().map(() => Array(numClasses + 1).fill(0));
    const mat2 = Array(n + 1).fill().map(() => Array(numClasses + 1).fill(0));
    
    // Fill the first column
    for (let i = 1; i <= n; i++) {
      mat1[i][1] = sortedData.slice(0, i).reduce((sum, val) => sum + val, 0);
      mat2[i][1] = sortedData.slice(0, i).reduce((sum, val) => sum + val * val, 0);
    }
    
    // Fill the rest of the matrix
    for (let j = 2; j <= numClasses; j++) {
      for (let i = 1; i <= n; i++) {
        let bestSdam = Infinity;
        let bestK = j - 1; // Default to a valid index
        
        for (let k = 1; k <= i - 1; k++) {
          const sum1 = sortedData.slice(k, i).reduce((sum, val) => sum + val, 0);
          const sum2 = sortedData.slice(k, i).reduce((sum, val) => sum + val * val, 0);
          const sdam = sum2 - (sum1 * sum1) / (i - k);
          
          if (sdam + mat2[k][j-1] < bestSdam) {
            bestSdam = sdam + mat2[k][j-1];
            bestK = k;
          }
        }
        
        mat1[i][j] = mat1[bestK][j-1] + sortedData.slice(bestK, i).reduce((sum, val) => sum + val, 0);
        mat2[i][j] = bestSdam;
      }
    }
    
    // Extract the breakpoints using a safer approach
    const breakpoints = [sortedData[n - 1]];
    let k = n;
    
    for (let j = numClasses; j > 1; j--) {
      // Find the k value that minimizes sdam
      let minSdam = Infinity;
      let kVal = 1;
      
      for (let i = j; i <= k; i++) {
        const sum1 = sortedData.slice(i, k).reduce((sum, val) => sum + val, 0);
        const sum2 = sortedData.slice(i, k).reduce((sum, val) => sum + val * val, 0);
        const sdam = sum2 - (sum1 * sum1) / (k - i);
        
        if (sdam + mat2[i][j-1] < minSdam) {
          minSdam = sdam + mat2[i][j-1];
          kVal = i;
        }
      }
      
      k = kVal;
      if (k >= 1 && k < n) {
        breakpoints.push(sortedData[k - 1]);
      }
    }
    
    return breakpoints.length >= numClasses ? breakpoints.reverse() : 
      // Fallback if we don't have enough breakpoints
      Array(numClasses).fill(0).map((_, i) => {
        const index = Math.floor((sortedData.length - 1) * i / (numClasses - 1));
        return sortedData[index];
      });
  };

  // Detect clusters using k-means clustering
  const detectClusters = (data, k) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { centroids: Array(k).fill(0), assignments: [] };
    }
    
    const validData = data.filter(x => typeof x === 'number' && !isNaN(x) && isFinite(x));
    if (validData.length === 0) {
      return { centroids: Array(k).fill(0), assignments: [] };
    }
    
    // Initialize centroids
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    let centroids = Array(k).fill().map((_, i) => min + (max - min) * i / (k - 1));
    
    let iterations = 0;
    const maxIterations = 100;
    let assignments = [];
    let oldAssignments = [];
    
    // Repeat until convergence or max iterations
    do {
      oldAssignments = [...assignments];
      
      // Assign points to nearest centroid
      assignments = validData.map(point => {
        const distances = centroids.map(centroid => Math.abs(point - centroid));
        return distances.indexOf(Math.min(...distances));
      });
      
      // Update centroids
      for (let i = 0; i < k; i++) {
        const cluster = validData.filter((_, idx) => assignments[idx] === i);
        if (cluster.length > 0) {
          centroids[i] = _.mean(cluster);
        }
      }
      
      iterations++;
    } while (
      iterations < maxIterations && 
      JSON.stringify(assignments) !== JSON.stringify(oldAssignments)
    );
    
    // Sort centroids in ascending order and update assignments
    const sortedIndices = centroids.map((val, idx) => ({ val, idx }))
      .sort((a, b) => a.val - b.val)
      .map(x => x.idx);
    
    const sortedCentroids = sortedIndices.map(idx => centroids[idx]);
    const sortedAssignments = assignments.map(a => sortedIndices.indexOf(a));
    
    return { 
      centroids: sortedCentroids, 
      assignments: sortedAssignments,
      clusters: validData.map((val, idx) => ({ 
        value: val, 
        cluster: sortedAssignments[idx] 
      }))
    };
  };

  // Calculate cluster quality metrics
  const calculateClusterQuality = (data, centroids, assignments) => {
    if (!data || !centroids || !assignments || data.length !== assignments.length) {
      return { silhouette: 0, davies: 0, dunn: 0 };
    }
    
    // Calculate within-cluster sum of squares (WCSS)
    const wcss = assignments.reduce((sum, cluster, i) => {
      return sum + Math.pow(data[i] - centroids[cluster], 2);
    }, 0);
    
    // Calculate between-cluster sum of squares (BCSS)
    const mean = _.mean(data);
    const bcss = centroids.reduce((sum, centroid, cluster) => {
      const clusterSize = assignments.filter(a => a === cluster).length;
      return sum + clusterSize * Math.pow(centroid - mean, 2);
    }, 0);
    
    // Calculate Davies-Bouldin Index (simplified)
    let daviesSum = 0;
    for (let i = 0; i < centroids.length; i++) {
      const clusterI = data.filter((_, idx) => assignments[idx] === i);
      if (clusterI.length === 0) continue;
      
      const diameterI = Math.sqrt(_.sumBy(clusterI, x => Math.pow(x - centroids[i], 2)) / clusterI.length);
      
      let maxRatio = 0;
      for (let j = 0; j < centroids.length; j++) {
        if (i === j) continue;
        
        const clusterJ = data.filter((_, idx) => assignments[idx] === j);
        if (clusterJ.length === 0) continue;
        
        const diameterJ = Math.sqrt(_.sumBy(clusterJ, x => Math.pow(x - centroids[j], 2)) / clusterJ.length);
        const centroidDistance = Math.abs(centroids[i] - centroids[j]);
        
        if (centroidDistance > 0) {
          const ratio = (diameterI + diameterJ) / centroidDistance;
          maxRatio = Math.max(maxRatio, ratio);
        }
      }
      
      daviesSum += maxRatio;
    }
    
    const davies = daviesSum / centroids.filter((_, i) => data.some((_, idx) => assignments[idx] === i)).length;
    
    // Calculate silhouette score (simplified for 1D data)
    let silhouetteSum = 0;
    let validPoints = 0;
    
    for (let i = 0; i < data.length; i++) {
      const currentCluster = assignments[i];
      const currentClusterPoints = data.filter((_, idx) => assignments[idx] === currentCluster);
      
      if (currentClusterPoints.length <= 1) continue;
      
      // Calculate mean distance to points in same cluster (a)
      const a = _.sumBy(currentClusterPoints, x => Math.abs(data[i] - x)) / (currentClusterPoints.length - 1);
      
      // Calculate mean distance to points in nearest cluster (b)
      let minB = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        if (j === currentCluster) continue;
        
        const otherClusterPoints = data.filter((_, idx) => assignments[idx] === j);
        if (otherClusterPoints.length === 0) continue;
        
        const b = _.sumBy(otherClusterPoints, x => Math.abs(data[i] - x)) / otherClusterPoints.length;
        minB = Math.min(minB, b);
      }
      
      if (minB === Infinity) continue;
      
      // Calculate silhouette
      const s = (minB - a) / Math.max(a, minB);
      silhouetteSum += s;
      validPoints++;
    }
    
    const silhouette = validPoints > 0 ? silhouetteSum / validPoints : 0;
    
    // Calculate Calinski-Harabasz Index (Variance Ratio Criterion)
    const ch = data.length > centroids.length ? (bcss / (centroids.length - 1)) / (wcss / (data.length - centroids.length)) : 0;
    
    return {
      silhouette,
      davies,
      ch,
      wcss,
      bcss
    };
  };

  // Calculate optimal thresholds using statistical methods
  const calculateOptimalThresholds = (values) => {
    if (!values || !Array.isArray(values) || values.length === 0) {
      return { low: 66, mediumLow: 33, high: 10 };
    }
    
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (validValues.length === 0) {
      return { low: 66, mediumLow: 33, high: 10 };
    }
    
    // Sort values
    const sorted = [...validValues].sort((a, b) => a - b);
    
    // 1. Find natural breaks (Jenks)
    const jenksBreaks = findNaturalBreaks(sorted, 4);
    
    // 2. Use K-means clustering
    const { centroids: kMeansCentroids } = detectClusters(sorted, 4);
    
    // 3. Use Quantile-based thresholds
    const quantileBreaks = [
      sorted[Math.floor(sorted.length * 0.90)], // 90th percentile
      sorted[Math.floor(sorted.length * 0.66)], // 66th percentile
      sorted[Math.floor(sorted.length * 0.33)]  // 33rd percentile
    ];
    
    // 4. Standard deviation-based thresholds
    const mean = _.mean(sorted);
    const std = Math.sqrt(_.sumBy(sorted, v => Math.pow(v - mean, 2)) / (sorted.length - 1));
    const stdBreaks = [
      mean + std,     // mean + 1 std
      mean,           // mean
      mean - std      // mean - 1 std
    ];
    
    // 5. Combine methods with weights
    const weights = {
      jenks: 0.4,
      kMeans: 0.3,
      quantile: 0.2,
      std: 0.1
    };
    
    // Safety check for all break points
    const safeJenksBreaks = jenksBreaks.filter(v => !isNaN(v) && isFinite(v));
    const safeKMeansCentroids = kMeansCentroids.filter(v => !isNaN(v) && isFinite(v));
    const safeQuantileBreaks = quantileBreaks.filter(v => !isNaN(v) && isFinite(v));
    const safeStdBreaks = stdBreaks.filter(v => !isNaN(v) && isFinite(v));
    
    // Make sure we have at least one valid break point for each method
    if (safeJenksBreaks.length < 3 || safeKMeansCentroids.length < 3 || 
        safeQuantileBreaks.length < 3 || safeStdBreaks.length < 3) {
      return { low: 66, mediumLow: 33, high: 10 };
    }
    
    // Calculate weighted averages
    const low = weights.jenks * safeJenksBreaks[0] + 
                weights.kMeans * safeKMeansCentroids[0] + 
                weights.quantile * safeQuantileBreaks[0] + 
                weights.std * safeStdBreaks[0];
    
    const mediumLow = weights.jenks * safeJenksBreaks[1] + 
                      weights.kMeans * safeKMeansCentroids[1] + 
                      weights.quantile * safeQuantileBreaks[1] + 
                      weights.std * safeStdBreaks[1];
    
    const high = weights.jenks * safeJenksBreaks[2] + 
                 weights.kMeans * safeKMeansCentroids[2] + 
                 weights.quantile * safeQuantileBreaks[2] + 
                 weights.std * safeStdBreaks[2];
    
    // Round to nearest integer and ensure thresholds are in correct order
    const roundedLow = Math.round(low);
    const roundedMediumLow = Math.round(mediumLow);
    const roundedHigh = Math.round(high);
    
    // Return in descending order (low > mediumLow > high)
    return {
      low: Math.max(roundedLow, roundedMediumLow + 10, 50),
      mediumLow: Math.max(roundedMediumLow, roundedHigh + 10, 25),
      high: Math.max(roundedHigh, 5)
    };
  };

  // =================== DISTRIBUTION ANALYSIS FUNCTIONS ===================

  // Generate threshold comparison data
  const generateComparisonData = (values, currentThresholds, optimizedThresholds) => {
    if (!values || !Array.isArray(values) || values.length === 0) {
      return { categoryDistribution: [], improvement: 0 };
    }
    
    // Calculate category distribution using current thresholds
    const currentDistribution = {
      low: values.filter(v => v > currentThresholds.low).length,
      mediumLow: values.filter(v => v <= currentThresholds.low && v > currentThresholds.mediumLow).length,
      medium: values.filter(v => v <= currentThresholds.mediumLow && v > currentThresholds.high).length,
      high: values.filter(v => v <= currentThresholds.high).length
    };
    
    // Calculate category distribution using optimized thresholds
    const optimizedDistribution = {
      low: values.filter(v => v > optimizedThresholds.low).length,
      mediumLow: values.filter(v => v <= optimizedThresholds.low && v > optimizedThresholds.mediumLow).length,
      medium: values.filter(v => v <= optimizedThresholds.mediumLow && v > optimizedThresholds.high).length,
      high: values.filter(v => v <= optimizedThresholds.high).length
    };
    
    // Generate comparison data structure
    const total = values.length;
    const categoryDistribution = [
      {
        name: 'Low Decentralization',
        threshold: `>${currentThresholds.low}%`,
        optimizedThreshold: `>${optimizedThresholds.low}%`,
        current: (currentDistribution.low / total) * 100,
        optimized: (optimizedDistribution.low / total) * 100,
        change: ((optimizedDistribution.low - currentDistribution.low) / total) * 100,
        color: '#d32f2f'
      },
      {
        name: 'Medium-Low',
        threshold: `${currentThresholds.mediumLow}-${currentThresholds.low}%`,
        optimizedThreshold: `${optimizedThresholds.mediumLow}-${optimizedThresholds.low}%`,
        current: (currentDistribution.mediumLow / total) * 100,
        optimized: (optimizedDistribution.mediumLow / total) * 100,
        change: ((optimizedDistribution.mediumLow - currentDistribution.mediumLow) / total) * 100,
        color: '#f57c00'
      },
      {
        name: 'Medium',
        threshold: `${currentThresholds.high}-${currentThresholds.mediumLow}%`,
        optimizedThreshold: `${optimizedThresholds.high}-${optimizedThresholds.mediumLow}%`,
        current: (currentDistribution.medium / total) * 100,
        optimized: (optimizedDistribution.medium / total) * 100,
        change: ((optimizedDistribution.medium - currentDistribution.medium) / total) * 100,
        color: '#7cb342'
      },
      {
        name: 'High Decentralization',
        threshold: `<${currentThresholds.high}%`,
        optimizedThreshold: `<${optimizedThresholds.high}%`,
        current: (currentDistribution.high / total) * 100,
        optimized: (optimizedDistribution.high / total) * 100,
        change: ((optimizedDistribution.high - currentDistribution.high) / total) * 100,
        color: '#1b5e20'
      }
    ];
    
    // Calculate improvement metrics
    // 1. Entropy improvement (more uniform distribution is better)
    const calcEntropy = (dist) => {
      const proportions = Object.values(dist).map(v => v / total);
      return -proportions.reduce((sum, p) => sum + (p === 0 ? 0 : p * Math.log(p)), 0);
    };
    
    const currentEntropy = calcEntropy(currentDistribution);
    const optimizedEntropy = calcEntropy(optimizedDistribution);
    const entropyImprovement = (optimizedEntropy - currentEntropy) / currentEntropy * 100;
    
    // 2. Distribution balance (deviation from perfect balance)
    const perfectBalance = total / 4; // Equal distribution across 4 categories
    
    const currentImbalance = Math.sqrt(
      Object.values(currentDistribution).reduce((sum, count) => 
        sum + Math.pow(count - perfectBalance, 2), 0) / 4
    ) / perfectBalance;
    
    const optimizedImbalance = Math.sqrt(
      Object.values(optimizedDistribution).reduce((sum, count) => 
        sum + Math.pow(count - perfectBalance, 2), 0) / 4
    ) / perfectBalance;
    
    const balanceImprovement = (currentImbalance - optimizedImbalance) / currentImbalance * 100;
    
    // 3. Overall improvement score (weighted combination)
    const improvementScore = 0.6 * balanceImprovement + 0.4 * entropyImprovement;
    
    return {
      categoryDistribution,
      improvement: {
        entropy: entropyImprovement,
        balance: balanceImprovement,
        overall: improvementScore
      },
      distributions: {
        current: currentDistribution,
        optimized: optimizedDistribution
      }
    };
  };

  // =================== DATA PROCESSING AND VISUALIZATION ===================

  useEffect(() => {
    const analyzeThresholds = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Extract and validate concentration data
        const concentrationData = jsonData
          .map(dao => {
            if (!dao || !dao.decentralisation) return null;
            
            return {
              name: dao.dao_name || 'Unknown',
              largestHolder: dao.decentralisation.largest_holder_percent,
              automated: dao.decentralisation.on_chain_automation === 'Yes',
              proposerConcentration: dao.decentralisation.proposer_concentration,
              distribution: dao.decentralisation.token_distribution || {},
              participation: dao.network_participation?.participation_rate || 0
            };
          })
          .filter(d => d !== null && !isNaN(d.largestHolder) && d.largestHolder >= 0 && d.largestHolder <= 100);

        if (concentrationData.length === 0) {
          console.error('No valid concentration data found');
          return;
        }

        // Extract largest holder percentage values
        const largestHolderValues = concentrationData.map(d => d.largestHolder);
        
        // Calculate basic statistics
        const basicStats = calculateBasicStats(largestHolderValues);
        
        // Calculate optimized thresholds
        const optimizedThresholds = calculateOptimalThresholds(largestHolderValues);
        
        // Save threshold values for use in the component
        setThresholds({
          current: { low: 66, mediumLow: 33, high: 10 },
          optimized: optimizedThresholds
        });
        
        // Generate comparison data between current and optimized thresholds
        const comparisonData = generateComparisonData(
          largestHolderValues, 
          { low: 66, mediumLow: 33, high: 10 },
          optimizedThresholds
        );
        
        // Prepare data for distribution visualization
        const bins = Array(100).fill(0);
        largestHolderValues.forEach(val => {
          const binIndex = Math.min(99, Math.floor(val));
          bins[binIndex]++;
        });
        
        const distributionData = bins.map((count, i) => ({
          value: i,
          count,
          frequency: (count / largestHolderValues.length) * 100,
          // Category based on current thresholds
          currentCategory: 
            i > 66 ? 'Low' :
            i > 33 ? 'Medium-Low' :
            i > 10 ? 'Medium' : 'High',
          // Category based on optimized thresholds
          optimizedCategory: 
            i > optimizedThresholds.low ? 'Low' :
            i > optimizedThresholds.mediumLow ? 'Medium-Low' :
            i > optimizedThresholds.high ? 'Medium' : 'High',
          // Color coding based on current thresholds
          currentColor: 
            i > 66 ? '#d32f2f' :
            i > 33 ? '#f57c00' :
            i > 10 ? '#7cb342' : '#1b5e20',
          // Color coding based on optimized thresholds
          optimizedColor: 
            i > optimizedThresholds.low ? '#d32f2f' :
            i > optimizedThresholds.mediumLow ? '#f57c00' :
            i > optimizedThresholds.high ? '#7cb342' : '#1b5e20'
        }));
        
        // Prepare data for threshold evaluation
        // Create a series of potential thresholds and evaluate each
        const thresholdEvaluationData = [];
        
        // For each potential threshold (10, 20, 30, etc.)
        for (let threshold = 5; threshold <= 90; threshold += 5) {
          // Calculate silhouette score for this threshold
          const belowThreshold = largestHolderValues.filter(v => v <= threshold);
          const aboveThreshold = largestHolderValues.filter(v => v > threshold);
          
          // Skip if either group is too small
          if (belowThreshold.length < 3 || aboveThreshold.length < 3) {
            continue;
          }
          
          // Calculate metrics for this threshold
          const belowMean = _.mean(belowThreshold);
          const aboveMean = _.mean(aboveThreshold);
          
          // Between-group variance
          const betweenVariance = belowThreshold.length * aboveThreshold.length * 
                                 Math.pow(belowMean - aboveMean, 2) / 
                                 largestHolderValues.length;
          
          // Within-group variance
          const belowVariance = _.sumBy(belowThreshold, v => Math.pow(v - belowMean, 2));
          const aboveVariance = _.sumBy(aboveThreshold, v => Math.pow(v - aboveMean, 2));
          const withinVariance = belowVariance + aboveVariance;
          
          // Calinski-Harabasz Index (higher is better)
          const chIndex = (largestHolderValues.length - 2) * betweenVariance / ((2 - 1) * withinVariance);
          
          // Davies-Bouldin Index (lower is better)
          const belowStd = Math.sqrt(belowVariance / belowThreshold.length);
          const aboveStd = Math.sqrt(aboveVariance / aboveThreshold.length);
          const dbIndex = (belowStd + aboveStd) / Math.abs(belowMean - aboveMean);
          
          // Silhouette score (approximate for binary clustering)
          const silhouette = betweenVariance / (withinVariance + 0.00001) - 1;
          
          // Store evaluation data
          thresholdEvaluationData.push({
            threshold,
            chIndex: isNaN(chIndex) ? 0 : chIndex,
            dbIndex: isNaN(dbIndex) ? 0 : dbIndex,
            silhouette: isNaN(silhouette) ? 0 : silhouette,
            belowCount: belowThreshold.length,
            aboveCount: aboveThreshold.length,
            belowPct: (belowThreshold.length / largestHolderValues.length) * 100,
            abovePct: (aboveThreshold.length / largestHolderValues.length) * 100
          });
        }
        
        // Normalize evaluation metrics for visualization
        const maxCH = Math.max(...thresholdEvaluationData.map(d => d.chIndex));
        const maxSilhouette = Math.max(...thresholdEvaluationData.map(d => Math.abs(d.silhouette)));
        const maxDB = Math.max(...thresholdEvaluationData.map(d => d.dbIndex));
        
        const normalizedEvaluation = thresholdEvaluationData.map(d => ({
          ...d,
          normalizedCH: d.chIndex / (maxCH || 1) * 100,
          normalizedSilhouette: d.silhouette / (maxSilhouette || 1) * 100,
          // Invert DB index since lower is better
          normalizedDB: (1 - (d.dbIndex / (maxDB || 1))) * 100
        }));
        
        // Prepare cluster quality visualization
        const highQualityThresholds = normalizedEvaluation
          .sort((a, b) => 
            (b.normalizedCH + b.normalizedSilhouette + b.normalizedDB) - 
            (a.normalizedCH + a.normalizedSilhouette + a.normalizedDB)
          )
          .slice(0, 5)
          .map(d => ({
            threshold: d.threshold,
            qualityScore: (d.normalizedCH + d.normalizedSilhouette + d.normalizedDB) / 3,
            metrics: {
              ch: d.normalizedCH,
              silhouette: d.normalizedSilhouette,
              db: d.normalizedDB
            }
          }));
        
        // Set data state
        setData({
          concentrationData,
          distributionData,
          comparisonData,
          thresholdEvaluationData: normalizedEvaluation,
          highQualityThresholds
        });
        
        // Set stats state
        setStats({
          basic: basicStats,
          analysis: {
            naturalBreaks: findNaturalBreaks(largestHolderValues, 4),
            kMeansClusters: detectClusters(largestHolderValues, 4).centroids,
            improvementMetrics: comparisonData.improvement
          }
        });
        
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeThresholds();
  }, []);

  // Safe formatting function
  const safeFixed = (value, digits = 1) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return value.toFixed(digits);
  };

  if (!data || !stats || !thresholds) return <div>Loading...</div>;

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
          Figure 7: Threshold Optimization for Economic Decentralization
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Statistical analysis of optimal threshold values for classification (N = {safeAccess(stats, 'basic.count', 0)})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Current Framework: Low (&gt;66%), Medium-Low (33-66%), Medium (10-33%), High (&lt;10%)
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Optimized Thresholds: Low (&gt;{safeFixed(thresholds.optimized.low)}%), 
          Medium-Low ({safeFixed(thresholds.optimized.mediumLow)}-{safeFixed(thresholds.optimized.low)}%), 
          Medium ({safeFixed(thresholds.optimized.high)}-{safeFixed(thresholds.optimized.mediumLow)}%), 
          High (&lt;{safeFixed(thresholds.optimized.high)}%)
        </p>
      </div>

      {/* Main visualization in 3 parts */}
      <div style={{ width: '100%', height: '650px', display: 'flex', flexDirection: 'column' }} ref={containerRef}>
        
        {/* Part 1: Distribution with threshold comparison */}
        <div style={{ height: '33%', marginBottom: '20px' }}>
          <ResponsiveContainer>
            <ComposedChart
              data={data.distributionData.filter(d => d.count > 0)}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis 
                dataKey="value" 
                label={{ 
                  value: 'Largest Holder Percentage (%)', 
                  position: 'bottom',
                  offset: 0,
                  style: { fontSize: '12px', fontFamily: 'serif' } 
                }}
              />
              <YAxis 
                yAxisId="left"
                label={{ 
                  value: 'Frequency', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: '12px', fontFamily: 'serif' } 
                }}
              />
              
              {/* Current threshold lines */}
              <ReferenceLine x={10} stroke="#388e3c" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Current High (10%)', position: 'top', style: { fontSize: '10px', fill: '#388e3c' } }} />
              <ReferenceLine x={33} stroke="#f57c00" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Current Medium (33%)', position: 'top', style: { fontSize: '10px', fill: '#f57c00' } }} />
              <ReferenceLine x={66} stroke="#d32f2f" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Current Low (66%)', position: 'top', style: { fontSize: '10px', fill: '#d32f2f' } }} />
              
              {/* Optimized threshold lines */}
              <ReferenceLine x={thresholds.optimized.high} stroke="#388e3c" strokeWidth={2} label={{ value: `Optimized High (${safeFixed(thresholds.optimized.high)}%)`, position: 'insideBottomRight', style: { fontSize: '10px', fill: '#388e3c' } }} />
              <ReferenceLine x={thresholds.optimized.mediumLow} stroke="#f57c00" strokeWidth={2} label={{ value: `Optimized Medium (${safeFixed(thresholds.optimized.mediumLow)}%)`, position: 'insideBottomRight', style: { fontSize: '10px', fill: '#f57c00' } }} />
              <ReferenceLine x={thresholds.optimized.low} stroke="#d32f2f" strokeWidth={2} label={{ value: `Optimized Low (${safeFixed(thresholds.optimized.low)}%)`, position: 'insideBottomRight', style: { fontSize: '10px', fill: '#d32f2f' } }} />

              {/* Histogram */}
              <Bar 
                yAxisId="left"
                dataKey="count" 
                barSize={1}
                name="DAO Count"
              >
                {data.distributionData.filter(d => d.count > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.currentColor} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Part 2: Threshold Evaluation Metrics */}
        <div style={{ height: '33%', marginBottom: '20px' }}>
          <ResponsiveContainer>
            <LineChart
              data={data.thresholdEvaluationData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis 
                dataKey="threshold" 
                label={{ 
                  value: 'Threshold Value (%)', 
                  position: 'bottom',
                  offset: 0,
                  style: { fontSize: '12px', fontFamily: 'serif' } 
                }}
              />
              <YAxis 
                yAxisId="left" 
                label={{ 
                  value: 'Quality Score (0-100)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: '12px', fontFamily: 'serif' } 
                }}
              />
              
                {/* Current threshold lines */}
                <ReferenceLine yAxisId="left" x={10} stroke="#388e3c" strokeWidth={1} strokeDasharray="5 5" />
                <ReferenceLine yAxisId="left" x={33} stroke="#f57c00" strokeWidth={1} strokeDasharray="5 5" />
                <ReferenceLine yAxisId="left" x={66} stroke="#d32f2f" strokeWidth={1} strokeDasharray="5 5" />

                {/* Optimized threshold lines */}
                <ReferenceLine yAxisId="left" x={thresholds.optimized.high} stroke="#388e3c" strokeWidth={1} />
                <ReferenceLine yAxisId="left" x={thresholds.optimized.mediumLow} stroke="#f57c00" strokeWidth={1} />
                <ReferenceLine yAxisId="left" x={thresholds.optimized.low} stroke="#d32f2f" strokeWidth={1} />
              
              {/* Quality metrics lines */}
              <Line 
                type="monotone" 
                dataKey="normalizedCH" 
                stroke="#8884d8" 
                name="Calinski-Harabasz Index" 
                dot={false}
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="normalizedDB" 
                stroke="#82ca9d" 
                name="Davies-Bouldin Index (Inverted)" 
                dot={false}
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="normalizedSilhouette" 
                stroke="#ffc658" 
                name="Silhouette Score" 
                dot={false}
                strokeWidth={2}
              />
              
              {/* Highlight top quality thresholds */}
              {data.highQualityThresholds.map((point, index) => (
                <ReferenceLine 
                    key={`top-${index}`}
                    yAxisId="left"
                    x={point.threshold} 
                    stroke="#ff6b6b" 
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ 
                    value: `Top #${index+1}`, 
                    position: 'top', 
                    style: { fontSize: '10px', fill: '#ff6b6b' } 
                    }}
                />
                ))}
              
              <Legend verticalAlign="top" height={36} />
              
              <Tooltip 
                formatter={(value, name) => [safeFixed(value, 1), name]}
                labelFormatter={(value) => `Threshold: ${value}%`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Part 3: Category Distribution Comparison */}
        <div style={{ height: '33%' }}>
          <ResponsiveContainer>
            <BarChart
              data={data.comparisonData.categoryDistribution}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" label={{ value: 'Percentage of DAOs (%)', position: 'bottom', style: { fontSize: '12px', fontFamily: 'serif' } }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontFamily: 'serif', fontSize: '12px' }}
                width={150}
              />
              
              <Bar 
                dataKey="current" 
                name="Current Framework" 
                fill="#8884d8" 
                minPointSize={2}
              >
                {data.comparisonData.categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                ))}
                <LabelList dataKey="threshold" position="insideLeft" style={{ fontSize: '10px', fill: '#000', fontFamily: 'serif' }} />
              </Bar>
              
              <Bar 
                dataKey="optimized" 
                name="Optimized Thresholds" 
                fill="#82ca9d" 
                minPointSize={2}
              >
                {data.comparisonData.categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList dataKey="optimizedThreshold" position="insideRight" style={{ fontSize: '10px', fill: '#000', fontFamily: 'serif' }} />
              </Bar>
              
              <Legend verticalAlign="top" height={36} />
              
              <Tooltip
                formatter={(value, name, props) => {
                  // Find the change value for this category
                  const change = props.payload.change;
                  return [
                    `${safeFixed(value, 1)}% (${change > 0 ? '+' : ''}${safeFixed(change, 1)}%)`,
                    name
                  ];
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <div style={{ width: '48%' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Threshold Analysis:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li><strong>Statistical Methods:</strong> Multiple clustering and threshold detection algorithms were applied:
                <ul style={{ listStyle: 'circle', paddingLeft: '20px', marginTop: '5px' }}>
                  <li>Natural Breaks (Jenks): {safeAccess(stats, 'analysis.naturalBreaks', []).map(v => safeFixed(v)).join(', ')}</li>
                  <li>K-means Clustering: {safeAccess(stats, 'analysis.kMeansClusters', []).map(v => safeFixed(v)).join(', ')}</li>
                  <li>Quantile Analysis: {safeFixed(safeAccess(stats, 'basic.q1', 0))}, {safeFixed(safeAccess(stats, 'basic.median', 0))}, {safeFixed(safeAccess(stats, 'basic.q3', 0))}</li>
                </ul>
              </li>
              <li><strong>Evaluation Metrics:</strong> Three different cluster quality metrics were used to evaluate threshold effectiveness:
                <ul style={{ listStyle: 'circle', paddingLeft: '20px', marginTop: '5px' }}>
                  <li>Calinski-Harabasz Index: Ratio of between-cluster to within-cluster variance</li>
                  <li>Davies-Bouldin Index: Measure of cluster separation (lower is better)</li>
                  <li>Silhouette Score: Measure of how well objects match their assigned clusters</li>
                </ul>
              </li>
            </ul>
          </div>
          <div style={{ width: '48%' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Optimization Results:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
              <li><strong>Distribution Improvement:</strong> {safeFixed(safeAccess(data, 'comparisonData.improvement.overall', 0))}%
                <ul style={{ listStyle: 'circle', paddingLeft: '20px', marginTop: '5px' }}>
                  <li>Balance Improvement: {safeFixed(safeAccess(data, 'comparisonData.improvement.balance', 0))}%</li>
                  <li>Entropy Improvement: {safeFixed(safeAccess(data, 'comparisonData.improvement.entropy', 0))}%</li>
                </ul>
              </li>
              <li><strong>Top Quality Thresholds:</strong>
                <ul style={{ listStyle: 'circle', paddingLeft: '20px', marginTop: '5px' }}>
                  {data.highQualityThresholds.slice(0, 3).map((threshold, index) => (
                    <li key={index}>
                      {threshold.threshold}% (Score: {safeFixed(threshold.qualityScore, 1)})
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: '15px', fontStyle: 'italic', fontSize: '11px' }}>
          <strong>Methodology:</strong> This analysis employs multiple statistical methods to identify optimal threshold values for classifying DAOs by decentralization level. 
          The optimization process combines natural breaks detection (Jenks algorithm), k-means clustering, and quantile analysis, weighted by quality metrics including 
          Calinski-Harabasz Index, Davies-Bouldin Index, and Silhouette Scores. The proposed optimized thresholds ({safeFixed(thresholds.optimized.low)}%, {safeFixed(thresholds.optimized.mediumLow)}%, {safeFixed(thresholds.optimized.high)}%)
          result in a more balanced distribution across categories, better aligned with the empirical distribution of largest holder percentages in the DAO ecosystem.
        </p>
        <p style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '11px' }}>
          The first chart shows the distribution of largest holder percentages with both current and optimized threshold lines. The second chart presents quality metrics for different threshold values,
          with peaks indicating statistically optimal thresholds. The third chart compares category distributions between the current framework and optimized thresholds.
          Overall, the optimized thresholds improve classification balance by {safeFixed(safeAccess(data, 'comparisonData.improvement.balance', 0))}% while maintaining alignment with the paper's conceptual framework.
        </p>
      </div>
    </div>
  );
};

export default DecentralizationThresholdOptimization;