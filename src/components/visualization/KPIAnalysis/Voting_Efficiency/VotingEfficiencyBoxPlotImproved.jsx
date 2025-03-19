import React, { useState, useEffect, useRef } from 'react';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

/**
 * A clean implementation of a box plot component for DAO Voting Efficiency
 * This component renders two vertical box plots showing the distribution of
 * approval rates and voting durations across DAOs.
 */

// Box Plot Component with improved label handling
const VerticalBox = ({ 
  min, 
  q1, 
  median, 
  q3, 
  max, 
  mean,
  x, 
  width, 
  stroke = "#000", 
  fill = "#1976D2",
  lowThreshold,
  highThreshold,
  unit,
  scale,
  rawValues // Original statistical values for accurate labels
}) => {
  return (
    <g transform={`translate(${x}, 0)`}>
      {/* Min-Max line (whisker) */}
      <line
        x1={width / 2}
        x2={width / 2}
        y1={min}
        y2={max}
        stroke={stroke}
        strokeWidth={1}
      />

      {/* Min whisker cap */}
      <line
        x1={width / 4}
        x2={(width * 3) / 4}
        y1={min}
        y2={min}
        stroke={stroke}
        strokeWidth={1}
      />

      {/* Max whisker cap */}
      <line
        x1={width / 4}
        x2={(width * 3) / 4}
        y1={max}
        y2={max}
        stroke={stroke}
        strokeWidth={1}
      />

      {/* Box (Q1-Q3) */}
      <rect
        x={0}
        y={q3}
        width={width}
        height={q1 - q3}
        stroke={stroke}
        fill={fill}
        fillOpacity={0.5}
      />

      {/* Median line */}
      <line
        x1={0}
        x2={width}
        y1={median}
        y2={median}
        stroke={stroke}
        strokeWidth={2}
      />

      {/* Mean diamond */}
      <polygon
        points={`${width/2-5},${mean} ${width/2},${mean-5} ${width/2+5},${mean} ${width/2},${mean+5}`}
        fill="#FF5722"
        stroke="#000"
        strokeWidth={0.5}
      />

      {/* Threshold lines */}
      {lowThreshold !== undefined && (
        <line
          x1={-width/2}
          x2={width*1.5}
          y1={lowThreshold}
          y2={lowThreshold}
          stroke="#F44336"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}

      {highThreshold !== undefined && (
        <line
          x1={-width/2}
          x2={width*1.5}
          y1={highThreshold}
          y2={highThreshold}
          stroke="#4CAF50"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}

      {/* Value labels using the raw values for accuracy */}
      <text
        x={width + 5}
        y={min}
        fontSize={10}
        dominantBaseline="middle"
        fontFamily="serif"
      >
        {rawValues.min.toFixed(1)}{unit}
      </text>
      <text
        x={width + 5}
        y={q1}
        fontSize={10}
        dominantBaseline="middle"
        fontFamily="serif"
      >
        {rawValues.q1.toFixed(1)}{unit}
      </text>
      <text
        x={width + 5}
        y={median}
        fontSize={10}
        fontWeight="bold"
        dominantBaseline="middle"
        fontFamily="serif"
      >
        {rawValues.median.toFixed(1)}{unit}
      </text>
      <text
        x={width + 5}
        y={q3}
        fontSize={10}
        dominantBaseline="middle"
        fontFamily="serif"
      >
        {rawValues.q3.toFixed(1)}{unit}
      </text>
      <text
        x={width + 5}
        y={max}
        fontSize={10}
        dominantBaseline="middle"
        fontFamily="serif"
      >
        {rawValues.max.toFixed(1)}{unit}
      </text>
      <text
        x={width + 5}
        y={mean}
        fontSize={10}
        fill="#FF5722"
        dominantBaseline="middle"
        fontFamily="serif"
      >
        μ={rawValues.mean.toFixed(1)}{unit}
      </text>
    </g>
  );
};

const VotingEfficiencyBoxPlotImproved = () => {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  // Chart dimensions
  const width = 800;
  const height = 500;
  const margin = { top: 50, right: 150, bottom: 80, left: 80 }; // Increased right margin for labels
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Handle export functions
  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'dao_voting_efficiency_boxplot', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'dao_voting_efficiency_boxplot');
    }
  };

  // Calculate quartiles
  const calculateQuartiles = (values) => {
    if (!values || values.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Calculate quartiles
    const q1Index = Math.floor(n * 0.25);
    const medianIndex = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index];
    const median = sorted[medianIndex];
    const q3 = sorted[q3Index];
    
    // Calculate IQR and identify outliers
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Find min and max (excluding outliers)
    let min = sorted[0];
    let max = sorted[n - 1];
    
    // If using Tukey's method to exclude outliers, uncomment this:
    // min = Math.max(sorted[0], lowerBound);
    // max = Math.min(sorted[n - 1], upperBound);
    
    return { min, q1, median, q3, max, iqr };
  };

  // Calculate standard deviation
  const calculateStd = (values, mean) => {
    if (!values || values.length < 2) return 0;
    return Math.sqrt(_.sum(values.map(val => Math.pow(val - mean, 2))) / (values.length - 1));
  };

  // Calculate confidence interval
  const calculateCI = (mean, std, n) => {
    if (!n || n < 2) return { lower: mean, upper: mean };
    const z = 1.96; // 95% confidence level
    const se = std / Math.sqrt(n);
    return {
      lower: mean - z * se,
      upper: mean + z * se
    };
  };

  // Calculate correlation coefficient
  const calculateCorrelation = (x, y) => {
    if (!x || !y || x.length !== y.length || x.length === 0) return 0;
    
    const xMean = _.mean(x);
    const yMean = _.mean(y);
    const numerator = _.sum(_.zipWith(x, y, (xi, yi) => (xi - xMean) * (yi - yMean)));
    const denominator = Math.sqrt(
      _.sum(x.map(xi => Math.pow(xi - xMean, 2))) *
      _.sum(y.map(yi => Math.pow(yi - yMean, 2)))
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Determine efficiency category based on KPI thresholds
  const getEfficiencyCategory = (approvalRate, duration) => {
    if (approvalRate < 30 || duration < 2) {
      return 'low';
    } else if (duration > 14) {
      return 'outlier';
    } else if (approvalRate > 70 && duration >= 3 && duration <= 14) {
      return 'high';
    } else {
      return 'medium';
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Try fetch API to get the data
        const response = await fetch('/data/dao-metrics.json');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const jsonData = await response.json();
        processData(jsonData);
      } catch (error) {
        console.error('Error loading data:', error);
        setError(`Failed to load data: ${error.message}`);
        setLoading(false);
      }
    };

    const processData = (jsonData) => {
      try {
        // Extract and validate voting efficiency data
        const processedData = jsonData
          .filter(dao => 
            dao.voting_efficiency && 
            dao.voting_efficiency.approval_rate !== undefined && 
            dao.voting_efficiency.avg_voting_duration_days !== undefined &&
            !isNaN(dao.voting_efficiency.approval_rate) && 
            !isNaN(dao.voting_efficiency.avg_voting_duration_days) &&
            dao.voting_efficiency.approval_rate >= 0 && 
            dao.voting_efficiency.approval_rate <= 100 &&
            dao.voting_efficiency.avg_voting_duration_days > 0
          )
          .map(dao => ({
            name: dao.dao_name || 'Unknown DAO',
            approvalRate: dao.voting_efficiency.approval_rate,
            duration: dao.voting_efficiency.avg_voting_duration_days,
            totalProposals: dao.voting_efficiency.total_proposals || 0,
            approvedProposals: dao.voting_efficiency.approved_proposals || 0,
            efficiency: getEfficiencyCategory(
              dao.voting_efficiency.approval_rate, 
              dao.voting_efficiency.avg_voting_duration_days
            )
          }));
        
        if (processedData.length === 0) {
          throw new Error("No valid voting efficiency data found");
        }

        // Extract approval rates and durations for statistical analysis
        const approvalRates = processedData.map(d => d.approvalRate);
        const durations = processedData.map(d => d.duration);
        
        // Calculate statistics for approval rates
        const approvalMean = _.mean(approvalRates);
        const approvalQuartiles = calculateQuartiles(approvalRates);
        const approvalStd = calculateStd(approvalRates, approvalMean);
        const approvalCI = calculateCI(approvalMean, approvalStd, approvalRates.length);
        
        // Calculate statistics for durations
        const durationMean = _.mean(durations);
        const durationQuartiles = calculateQuartiles(durations);
        const durationStd = calculateStd(durations, durationMean);
        const durationCI = calculateCI(durationMean, durationStd, durations.length);
        
        // Calculate efficiency categories
        const efficiencyGroups = {
          low: processedData.filter(d => d.efficiency === 'low').length,
          medium: processedData.filter(d => d.efficiency === 'medium').length,
          high: processedData.filter(d => d.efficiency === 'high').length,
          outlier: processedData.filter(d => d.efficiency === 'outlier').length
        };
        
        // Set data state
        setData(processedData);
        
        // Set statistics state
        setStats({
          approval: {
            ...approvalQuartiles,
            mean: approvalMean,
            std: approvalStd,
            ci: approvalCI,
            n: approvalRates.length
          },
          duration: {
            ...durationQuartiles,
            mean: durationMean,
            std: durationStd,
            ci: durationCI,
            n: durations.length
          },
          correlation: calculateCorrelation(approvalRates, durations),
          efficiency: efficiencyGroups,
          totalDAOs: processedData.length
        });
        
        // Debug log
        console.log("Processed stats:", {
          approval: {
            ...approvalQuartiles,
            mean: approvalMean
          },
          duration: {
            ...durationQuartiles,
            mean: durationMean
          }
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error processing data:', error);
        setError(`Error processing data: ${error.message}`);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Render loading state
  if (loading) {
    return <div>Loading voting efficiency data...</div>;
  }

  // Render error state
  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!data || !stats) {
    return <div>No valid data available for analysis</div>;
  }

  // Simple linear scale function
  const scaleLinear = (domain, range) => {
    const domainDiff = domain[1] - domain[0];
    const rangeDiff = range[1] - range[0];
    
    return (value) => {
      const normalizedValue = (value - domain[0]) / domainDiff;
      return range[0] + normalizedValue * rangeDiff;
    };
  };

  // Define scales for the y-axis
  const approvalDomain = [0, 100]; // Fixed domain for approval rate (%)
  // Ensure duration domain is appropriate and doesn't cause weird display issues
  const durationMax = Math.max(16, Math.ceil(stats.duration.max * 1.2));
  const durationDomain = [0, durationMax]; 
  
  const yScaleApproval = scaleLinear(approvalDomain, [innerHeight, 0]);
  const yScaleDuration = scaleLinear(durationDomain, [innerHeight, 0]);

  // Generate ticks for the y-axis
  const generateTicks = (min, max, count) => {
    const step = (max - min) / (count - 1);
    return Array.from({ length: count }, (_, i) => min + i * step);
  };

  const approvalTicks = generateTicks(0, 100, 6); // 0, 20, 40, 60, 80, 100
  const durationTicks = generateTicks(0, durationDomain[1], 6);
  
  return (
    <div style={{ width: '100%', padding: '20px', fontFamily: 'serif' }}>
      <div style={{ marginBottom: '15px' }}>
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

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
          Figure 5: Box Plot Analysis of DAO Voting Efficiency Metrics
        </h2>
        <p style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>
          Statistical distribution of approval rates and voting durations across {stats.totalDAOs} Decentralised Autonomous Organizations
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Correlation coefficient: r = {stats.correlation.toFixed(3)} ({Math.abs(stats.correlation) < 0.3 ? 'weak' : Math.abs(stats.correlation) < 0.7 ? 'moderate' : 'strong'} {stats.correlation > 0 ? 'positive' : 'negative'} correlation)
        </p>
      </div>

      {/* Box Plot Visualization */}
      <div style={{ width: '100%', height: `${height}px`, marginBottom: '40px', border: '1px solid #eee' }} ref={containerRef}>
        <svg width={width} height={height}>
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Y-axis grid lines for approval rate */}
            {approvalTicks.map((tick) => (
              <line
                key={`grid-approval-${tick}`}
                x1={0}
                x2={innerWidth / 2 - 30}
                y1={yScaleApproval(tick)}
                y2={yScaleApproval(tick)}
                stroke="#e0e0e0"
                strokeDasharray="3,3"
              />
            ))}
            
            {/* Y-axis grid lines for duration */}
            {durationTicks.map((tick) => (
              <line
                key={`grid-duration-${tick}`}
                x1={innerWidth / 2 + 30}
                x2={innerWidth}
                y1={yScaleDuration(tick)}
                y2={yScaleDuration(tick)}
                stroke="#e0e0e0"
                strokeDasharray="3,3"
              />
            ))}
            
            {/* Y-axis for Approval Rate */}
            <g>
              {approvalTicks.map((tick) => (
                <g key={`tick-approval-${tick}`} transform={`translate(0, ${yScaleApproval(tick)})`}>
                  <line x1={-6} x2={0} stroke="#666" />
                  <text
                    x={-10}
                    dy="0.32em"
                    textAnchor="end"
                    fontSize={10}
                    fontFamily="serif"
                  >
                    {tick}%
                  </text>
                </g>
              ))}
              <text
                transform={`translate(${-40}, ${innerHeight / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize={12}
                fontFamily="serif"
                fontWeight="bold"
              >
                Approval Rate (%)
              </text>
            </g>
            
            {/* Y-axis for Duration */}
            <g transform={`translate(${innerWidth}, 0)`}>
              {durationTicks.map((tick) => (
                <g key={`tick-duration-${tick}`} transform={`translate(0, ${yScaleDuration(tick)})`}>
                  <line x1={0} x2={6} stroke="#666" />
                  <text
                    x={10}
                    dy="0.32em"
                    textAnchor="start"
                    fontSize={10}
                    fontFamily="serif"
                  >
                    {tick.toFixed(0)}d
                  </text>
                </g>
              ))}
              <text
                transform={`translate(${40}, ${innerHeight / 2}) rotate(90)`}
                textAnchor="middle"
                fontSize={12}
                fontFamily="serif"
                fontWeight="bold"
              >
                Voting Duration (days)
              </text>
            </g>

            {/* Box plots with fixed value labels */}
            <VerticalBox
              min={yScaleApproval(stats.approval.min)}
              q1={yScaleApproval(stats.approval.q1)}
              median={yScaleApproval(stats.approval.median)}
              q3={yScaleApproval(stats.approval.q3)}
              max={yScaleApproval(stats.approval.max)}
              mean={yScaleApproval(stats.approval.mean)}
              x={innerWidth / 4 - 40}
              width={80}
              stroke="#000"
              fill="#1976D2"
              unit="%"
              lowThreshold={yScaleApproval(30)}
              highThreshold={yScaleApproval(70)}
              scale={yScaleApproval}
              rawValues={stats.approval} // Pass raw values for accurate labels
            />
            
            <VerticalBox
              min={yScaleDuration(stats.duration.min)}
              q1={yScaleDuration(stats.duration.q1)}
              median={yScaleDuration(stats.duration.median)}
              q3={yScaleDuration(stats.duration.q3)}
              max={yScaleDuration(stats.duration.max)}
              mean={yScaleDuration(stats.duration.mean)}
              x={innerWidth * 3 / 4 - 40}
              width={80}
              stroke="#000"
              fill="#81C784"
              unit="d"
              lowThreshold={yScaleDuration(2)}
              highThreshold={yScaleDuration(14)}
              scale={yScaleDuration}
              rawValues={stats.duration} // Pass raw values for accurate labels
            />

            {/* X-axis labels */}
            <text
              x={innerWidth / 4}
              y={innerHeight + 30}
              textAnchor="middle"
              fontSize={14}
              fontWeight="bold"
              fontFamily="serif"
            >
              Approval Rate
            </text>
            
            <text
              x={innerWidth * 3 / 4}
              y={innerHeight + 30}
              textAnchor="middle"
              fontSize={14}
              fontWeight="bold"
              fontFamily="serif"
            >
              Voting Duration
            </text>
            
            {/* Legend with better positioning */}
            <g transform={`translate(${innerWidth / 2 - 200}, ${innerHeight + 45})`}>
              {/* First row of legend items */}
              <rect width={15} height={15} fill="#1976D2" fillOpacity={0.5} stroke="#000" />
              <text x={20} y={12} fontSize={11} fontFamily="serif">Interquartile Range (Q₁-Q₃)</text>
              
              <line x1={230} y1={7} x2={245} y2={7} stroke="#000" strokeWidth={2} />
              <text x={250} y={12} fontSize={11} fontFamily="serif">Median</text>
              
              {/* Second row of legend items */}
              <g transform={`translate(0, 20)`}>
                <line x1={0} y1={7} x2={15} y2={7} stroke="#000" strokeWidth={1} />
                <text x={20} y={12} fontSize={11} fontFamily="serif">Min-Max Range</text>
                
                <polygon points="230,7 235,2 240,7 235,12" fill="#FF5722" stroke="#000" strokeWidth={0.5} />
                <text x={250} y={12} fontSize={11} fontFamily="serif">Mean (μ)</text>
              </g>
              
              {/* Third row for KPI thresholds */}
              <g transform={`translate(125, 40)`}>
                <line x1={0} y1={7} x2={15} y2={7} stroke="#F44336" strokeDasharray="3,3" />
                <text x={20} y={12} fontSize={11} fontFamily="serif">KPI Thresholds</text>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Statistical Summary Table */}
      <div style={{ width: '100%', marginTop: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center', fontFamily: 'serif' }}>
          Table 1: Statistical Summary of DAO Voting Efficiency Metrics (N = {stats.totalDAOs})
        </h3>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'serif', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Statistic</th>
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Approval Rate (%)</th>
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Voting Duration (days)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Number of DAOs</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.n}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.n}</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Minimum</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.min.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.min.toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>First Quartile (Q₁)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.q1.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.q1.toFixed(1)}</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Median</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.median.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.median.toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Third Quartile (Q₃)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.q3.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.q3.toFixed(1)}</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Maximum</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.max.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.max.toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Mean (μ)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.mean.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.mean.toFixed(1)}</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Standard Deviation (σ)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.approval.std.toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.duration.std.toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>95% Confidence Interval</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>[{stats.approval.ci.lower.toFixed(1)}, {stats.approval.ci.upper.toFixed(1)}]</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>[{stats.duration.ci.lower.toFixed(1)}, {stats.duration.ci.upper.toFixed(1)}]</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Interquartile Range (IQR)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{(stats.approval.q3 - stats.approval.q1).toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{(stats.duration.q3 - stats.duration.q1).toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Coefficient of Variation (%)</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.approval.std / stats.approval.mean) * 100).toFixed(1)}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.duration.std / stats.duration.mean) * 100).toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Efficiency Categories Table */}
      <div style={{ width: '100%', marginTop: '30px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center', fontFamily: 'serif' }}>
          Table 2: Efficiency Distribution across DAOs
        </h3>
        
        <table style={{ width: '100%', maxWidth: '600px', margin: '0 auto', borderCollapse: 'collapse', fontFamily: 'serif', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Efficiency Category</th>
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Number of DAOs</th>
              <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Percentage</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', borderTop: '1px solid #ddd' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', color: '#4CAF50', borderBottom: '1px solid #eee' }}>High Efficiency</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.efficiency?.high || 0}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.efficiency?.high || 0) / stats.totalDAOs * 100).toFixed(1)}%</td>
              <td style={{ padding: '6px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #eee' }}>Approval rate &gt;70%, duration 3-14 days</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', color: '#FFC107', borderBottom: '1px solid #eee' }}>Medium Efficiency</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.efficiency?.medium || 0}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.efficiency?.medium || 0) / stats.totalDAOs * 100).toFixed(1)}%</td>
              <td style={{ padding: '6px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #eee' }}>Approval rate 30-70%, duration 3-14 days</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold', color: '#F44336', borderBottom: '1px solid #eee' }}>Low Efficiency</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.efficiency?.low || 0}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.efficiency?.low || 0) / stats.totalDAOs * 100).toFixed(1)}%</td>
              <td style={{ padding: '6px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #eee' }}>Approval rate &lt;30% or duration &lt;2 days</td>
            </tr>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', color: '#9C27B0', borderBottom: '1px solid #eee' }}>Duration Outliers</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{stats.efficiency?.outlier || 0}</td>
              <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{((stats.efficiency?.outlier || 0) / stats.totalDAOs * 100).toFixed(1)}%</td>
              <td style={{ padding: '6px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #eee' }}>Voting duration &gt;14 days</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Statistical Interpretation */}
      <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '30px', lineHeight: '1.5', fontFamily: 'serif' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', fontStyle: 'normal' }}>Statistical Interpretation</h3>
        
        <p>
          <strong>Box Plot Analysis:</strong> The box plot visualization reveals a median approval rate of {stats.approval.median.toFixed(1)}% across the DAOs studied, with an interquartile range of {(stats.approval.q3 - stats.approval.q1).toFixed(1)} percentage points. 
          This indicates that the middle 50% of DAOs have approval rates between {stats.approval.q1.toFixed(1)}% and {stats.approval.q3.toFixed(1)}%.
          Voting durations show a median of {stats.duration.median.toFixed(1)} days, with quartiles at {stats.duration.q1.toFixed(1)} and {stats.duration.q3.toFixed(1)} days respectively.
        </p>
        
        <p>
          <strong>Distribution Characteristics:</strong> The {Math.abs((stats.approval.mean - stats.approval.median) / stats.approval.std) < 0.1 ? 'symmetrical distribution' : stats.approval.mean > stats.approval.median ? 'right-skewed distribution' : 'left-skewed distribution'} of approval rates suggests 
          {stats.approval.mean > stats.approval.median ? ' that there are a few DAOs with exceptionally high approval rates pulling the mean upward.' : stats.approval.mean < stats.approval.median ? ' that there are a few DAOs with very low approval rates pulling the mean downward.' : ' a balanced spread of approval rates among DAOs.'} 
          The coefficient of variation ({((stats.approval.std / stats.approval.mean) * 100).toFixed(1)}%) indicates 
          {((stats.approval.std / stats.approval.mean) * 100) < 15 ? ' relatively low variability' : ((stats.approval.std / stats.approval.mean) * 100) < 30 ? ' moderate variability' : ' high variability'} in approval rates relative to the mean.
        </p>
        
        <p>
          <strong>Correlation Analysis:</strong> The correlation coefficient (r = {stats.correlation.toFixed(3)}) indicates a {Math.abs(stats.correlation) < 0.3 ? 'weak' : Math.abs(stats.correlation) < 0.7 ? 'moderate' : 'strong'} {stats.correlation > 0 ? 'positive' : 'negative'} relationship between approval rates and voting duration,
          suggesting that {stats.correlation > 0 ? 'longer voting periods may contribute to higher approval rates, possibly allowing more time for deliberation and consensus-building.' : 'shorter voting periods may be associated with higher approval rates, potentially indicating more decisive governance or clearer proposals.'} 
          However, correlation does not imply causation, and other factors may influence both metrics.
        </p>
        
        <p>
          <strong>Efficiency Categories:</strong> The efficiency analysis reveals that {((stats.efficiency?.high || 0) / stats.totalDAOs * 100).toFixed(1)}% of DAOs achieve high efficiency (approval rate &gt;70% with appropriate voting duration), 
          while {((stats.efficiency?.low || 0) / stats.totalDAOs * 100).toFixed(1)}% exhibit low efficiency (approval rate &lt;30% or insufficient voting time).
          The {((stats.efficiency?.outlier || 0) / stats.totalDAOs * 100).toFixed(1)}% of DAOs with extended voting periods (&gt;14 days) may represent organizations with more complex governance needs or 
          potentially suboptimal decision-making processes.
        </p>
        
        <p>
          <strong>Implications:</strong> These findings suggest that optimizing voting duration within the 3-14 day range while maintaining high approval rates represents a key opportunity for improving DAO governance efficiency. 
          The {stats.approval.median > 60 ? 'relatively high' : stats.approval.median < 40 ? 'relatively low' : 'moderate'} median approval rate of {stats.approval.median.toFixed(1)}% indicates that 
          {stats.approval.median > 60 ? ' most DAOs are successfully achieving consensus on their proposals.' : stats.approval.median < 40 ? ' many DAOs struggle to achieve majority approval for their proposals.' : ' DAOs show mixed success in achieving consensus.'} 
          Further research could explore causal factors influencing these metrics and identify best practices for DAO governance design.
        </p>
      </div>
    </div>
  );
};

export default VotingEfficiencyBoxPlotImproved;



