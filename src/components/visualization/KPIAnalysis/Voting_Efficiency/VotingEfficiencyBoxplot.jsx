import React, { useState, useEffect, useRef } from 'react';
import { 
  ComposedChart, 
  Area, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine,
  Label,
  ResponsiveContainer,
  Scatter,
  Cell
} from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

// Custom BoxPlot component for statistical visualization
const VotingEfficiencyBoxPlot = () => {
  const [data, setData] = useState([]);
  const [boxPlotData, setBoxPlotData] = useState([]);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);
  const binWidth = 5; // 5% bins

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'voting_efficiency_boxplot', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'voting_efficiency_boxplot');
    }
  };

  // Calculate quartiles for box plot
  const calculateQuartiles = (values) => {
    if (!values || values.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    return {
      min: sorted[0],
      q1: sorted[Math.floor(n * 0.25)],
      median: sorted[Math.floor(n * 0.5)],
      q3: sorted[Math.floor(n * 0.75)],
      max: sorted[n - 1]
    };
  };

  // Calculate standard deviation
  const calculateStd = (values, mean) => {
    return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1));
  };

  // Calculate confidence interval
  const calculateCI = (mean, std, n) => {
    const z = 1.96; // 95% confidence level
    const se = std / Math.sqrt(n);
    return {
      lower: mean - z * se,
      upper: mean + z * se
    };
  };

  // Determine efficiency category
  const getEfficiencyCategory = (approvalRate, duration) => {
    if (approvalRate < 30 || duration < 2) {
      return 'low';
    } else if (duration > 14) {
      return 'outlier';
    } else if (approvalRate > 70) {
      return 'high';
    } else {
      return 'medium';
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First try to load data with fetch
        let jsonData;
        try {
          const response = await fetch('/data/dao-metrics.json');
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          jsonData = await response.json();
        } catch (fetchError) {
          console.log("Fetch approach failed, trying alternative method");
          const data = await window.fs.readFile('paste-3.txt', { encoding: 'utf8' });
          jsonData = JSON.parse(data);
        }
        
        // Process data for box plot visualization
        const validData = jsonData
          .filter(dao => 
            dao.voting_efficiency &&
            !isNaN(dao.voting_efficiency.approval_rate) &&
            !isNaN(dao.voting_efficiency.avg_voting_duration_days) &&
            dao.voting_efficiency.approval_rate >= 0 && 
            dao.voting_efficiency.approval_rate <= 100 &&
            dao.voting_efficiency.avg_voting_duration_days > 0
          )
          .map(dao => ({
            name: dao.dao_name,
            approvalRate: dao.voting_efficiency.approval_rate,
            duration: dao.voting_efficiency.avg_voting_duration_days,
            totalProposals: dao.voting_efficiency.total_proposals || 0,
            approvedProposals: dao.voting_efficiency.approved_proposals || 0,
            efficiency: getEfficiencyCategory(dao.voting_efficiency.approval_rate, dao.voting_efficiency.avg_voting_duration_days)
          }));
          
        // Extract key metrics
        const approvalRates = validData.map(d => d.approvalRate);
        const durations = validData.map(d => d.duration);
        
        // Calculate statistics for approval rates
        const approvalQuartiles = calculateQuartiles(approvalRates);
        const approvalMean = _.mean(approvalRates);
        const approvalStd = calculateStd(approvalRates, approvalMean);
        const approvalCI = calculateCI(approvalMean, approvalStd, approvalRates.length);
        const approvalIQR = approvalQuartiles.q3 - approvalQuartiles.q1;
        
        // Calculate statistics for durations
        const durationQuartiles = calculateQuartiles(durations);
        const durationMean = _.mean(durations);
        const durationStd = calculateStd(durations, durationMean);
        const durationCI = calculateCI(durationMean, durationStd, durations.length);
        const durationIQR = durationQuartiles.q3 - durationQuartiles.q1;
        
        // Identify outliers
        const approvalOutliers = validData.filter(d => 
          d.approvalRate < approvalQuartiles.q1 - 1.5 * approvalIQR ||
          d.approvalRate > approvalQuartiles.q3 + 1.5 * approvalIQR
        );
        
        const durationOutliers = validData.filter(d => 
          d.duration < durationQuartiles.q1 - 1.5 * durationIQR ||
          d.duration > durationQuartiles.q3 + 1.5 * durationIQR
        );
        
        // Calculate efficiency categories
        const efficiencyGroups = {
          low: validData.filter(d => d.efficiency === 'low').length,
          medium: validData.filter(d => d.efficiency === 'medium').length,
          high: validData.filter(d => d.efficiency === 'high').length,
          outlier: validData.filter(d => d.efficiency === 'outlier').length
        };
        
        // Create box plot visualization data
        const approvalBoxData = [
          {
            type: 'Approval Rate',
            min: approvalQuartiles.min,
            q1: approvalQuartiles.q1,
            median: approvalQuartiles.median,
            q3: approvalQuartiles.q3,
            max: approvalQuartiles.max,
            mean: approvalMean,
            outliers: approvalOutliers.map(d => d.approvalRate)
          }
        ];
        
        const durationBoxData = [
          {
            type: 'Voting Duration',
            min: durationQuartiles.min,
            q1: durationQuartiles.q1,
            median: durationQuartiles.median,
            q3: durationQuartiles.q3,
            max: durationQuartiles.max,
            mean: durationMean,
            outliers: durationOutliers.map(d => d.duration)
          }
        ];
        
        // Set state with processed data
        setData(validData);
        setBoxPlotData({
          approval: approvalBoxData,
          duration: durationBoxData
        });
        
        // Set statistics
        setStats({
          approval: {
            ...approvalQuartiles,
            mean: approvalMean,
            std: approvalStd,
            ci: approvalCI,
            iqr: approvalIQR,
            outliers: approvalOutliers.length
          },
          duration: {
            ...durationQuartiles,
            mean: durationMean,
            std: durationStd,
            ci: durationCI,
            iqr: durationIQR,
            outliers: durationOutliers.length
          },
          efficiency: efficiencyGroups,
          totalDAOs: validData.length
        });
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    fetchData();
  }, []);

  // Create visualization-friendly data
  const getDistributionData = () => {
    if (!stats) return [];
    
    // Create bins for approval rate distribution
    const binWidth = 5; // 5% bins
    const bins = [];
    
    // Generate bins from 0 to 100 in steps of binWidth
    for (let i = 0; i < 100; i += binWidth) {
      bins.push({
        binStart: i,
        binEnd: i + binWidth,
        label: `${i}-${i + binWidth}%`,
        count: 0
      });
    }
    
    // Count DAOs in each bin
    data.forEach(dao => {
      const bin = bins.find(b => dao.approvalRate >= b.binStart && dao.approvalRate < b.binEnd);
      if (bin) bin.count++;
    });
    
    // Calculate frequency
    bins.forEach(bin => {
      bin.frequency = (bin.count / data.length) * 100;
    });
    
    // Add box plot indicators to distribution
    return bins.map(bin => {
      const midpoint = (bin.binStart + bin.binEnd) / 2;
      return {
        ...bin,
        isQ1: midpoint >= stats.approval.q1 - binWidth/2 && midpoint < stats.approval.q1 + binWidth/2,
        isMedian: midpoint >= stats.approval.median - binWidth/2 && midpoint < stats.approval.median + binWidth/2,
        isQ3: midpoint >= stats.approval.q3 - binWidth/2 && midpoint < stats.approval.q3 + binWidth/2,
        isMean: midpoint >= stats.approval.mean - binWidth/2 && midpoint < stats.approval.mean + binWidth/2
      };
    });
  };

  // Create data for combined visualization
  const getScatterData = () => {
    return data.map(dao => ({
      ...dao,
      fill: dao.efficiency === 'high' ? '#4CAF50' : 
            dao.efficiency === 'medium' ? '#FFC107' : 
            dao.efficiency === 'outlier' ? '#9C27B0' : '#F44336'
    }));
  };

  if (!stats) {
    return <div>Loading data...</div>;
  }

  // Get distribution data for visualization
  const distributionData = getDistributionData();
  const scatterData = getScatterData();

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
          Figure 4: (TEST) Statistical Distribution of Voting Efficiency Metrics
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Box plot and distribution analysis of approval rates and voting durations (N = {stats.totalDAOs})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Approval Rate: Q1 = {stats.approval.q1.toFixed(1)}%, Median = {stats.approval.median.toFixed(1)}%, 
          Q3 = {stats.approval.q3.toFixed(1)}%, IQR = {stats.approval.iqr.toFixed(1)}%
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Voting Duration: Q1 = {stats.duration.q1.toFixed(1)}d, Median = {stats.duration.median.toFixed(1)}d, 
          Q3 = {stats.duration.q3.toFixed(1)}d, IQR = {stats.duration.iqr.toFixed(1)}d
        </p>
      </div>

      {/* Approval Rate Distribution */}
      <div style={{ width: '100%', height: '300px', marginBottom: '40px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ComposedChart
            data={distributionData}
            margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="label"
              label={{ 
                value: 'Approval Rate (%)', 
                position: 'bottom', 
                offset: 20,
                style: { fontFamily: 'serif', fontSize: '12px' } 
              }}
            />
            <YAxis 
              label={{ 
                value: 'Relative Frequency (%)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 40,
                style: { fontFamily: 'serif', fontSize: '12px' } 
              }}
              domain={[0, 'auto']}
            />
            
            {/* Box plot indicators */}
            <ReferenceLine 
              x={stats.approval.q1.toFixed(0) + "-" + (parseInt(stats.approval.q1.toFixed(0)) + binWidth) + "%"} 
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: 'Q1', 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.approval.median.toFixed(0) + "-" + (parseInt(stats.approval.median.toFixed(0)) + binWidth) + "%"} 
              stroke="#1565C0" 
              strokeWidth={2}
              label={{ 
                value: 'Median', 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.approval.q3.toFixed(0) + "-" + (parseInt(stats.approval.q3.toFixed(0)) + binWidth) + "%"}
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: 'Q3', 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.approval.mean.toFixed(0) + "-" + (parseInt(stats.approval.mean.toFixed(0)) + binWidth) + "%"}
              stroke="#FF5722" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: 'Mean', 
                position: 'top', 
                fill: '#FF5722',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            {/* Category thresholds */}
            <ReferenceLine 
              x="30-35%" 
              stroke="#F44336" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'Low Threshold (30%)', 
                position: 'bottom', 
                fill: '#F44336',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x="70-75%" 
              stroke="#4CAF50" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'High Threshold (70%)', 
                position: 'bottom', 
                fill: '#4CAF50',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            {/* Bar chart visualization */}
            <Bar dataKey="frequency" fill="#90CAF9" name="Frequency">
              {distributionData.map((entry, index) => {
                let fill = '#90CAF9';
                if (entry.isMedian) fill = '#1565C0';
                else if (entry.isQ1 || entry.isQ3) fill = '#42A5F5';
                else if (entry.isMean) fill = '#FF5722';
                
                return <Cell key={`cell-${index}`} fill={fill} />;
              })}
            </Bar>
            
            <Tooltip
              formatter={(value, name) => [`${value.toFixed(1)}%`, 'Frequency']}
              labelFormatter={(label) => `Approval Rate: ${label}`}
              contentStyle={{ fontFamily: 'serif' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Duration Distribution */}
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer>
          <ComposedChart
            margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              type="number"
              dataKey="duration"
              domain={[0, Math.min(30, stats.duration.max * 1.1)]}
              label={{ 
                value: 'Voting Duration (days)', 
                position: 'bottom', 
                offset: 20,
                style: { fontFamily: 'serif', fontSize: '12px' } 
              }}
            />
            <YAxis 
              type="number"
              dataKey="approvalRate"
              domain={[0, 100]}
              label={{ 
                value: 'Approval Rate (%)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 40,
                style: { fontFamily: 'serif', fontSize: '12px' } 
              }}
            />
            
            {/* Box plot indicators for duration */}
            <ReferenceLine 
              x={stats.duration.q1} 
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Q1 (${stats.duration.q1.toFixed(1)}d)`, 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.duration.median} 
              stroke="#1565C0" 
              strokeWidth={2}
              label={{ 
                value: `Median (${stats.duration.median.toFixed(1)}d)`, 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.duration.q3}
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Q3 (${stats.duration.q3.toFixed(1)}d)`, 
                position: 'top', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={stats.duration.mean}
              stroke="#FF5722" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: `Mean (${stats.duration.mean.toFixed(1)}d)`, 
                position: 'top', 
                fill: '#FF5722',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            {/* Box plot indicators for approval */}
            <ReferenceLine 
              y={stats.approval.q1} 
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Q1 (${stats.approval.q1.toFixed(1)}%)`, 
                position: 'right', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              y={stats.approval.median} 
              stroke="#1565C0" 
              strokeWidth={2}
              label={{ 
                value: `Median (${stats.approval.median.toFixed(1)}%)`, 
                position: 'right', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              y={stats.approval.q3}
              stroke="#1565C0" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Q3 (${stats.approval.q3.toFixed(1)}%)`, 
                position: 'right', 
                fill: '#1565C0',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            {/* Category thresholds */}
            <ReferenceLine 
              x={2} 
              stroke="#F44336" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'Min Duration (2d)', 
                position: 'bottom', 
                fill: '#F44336',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              x={14} 
              stroke="#F44336" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'Max Duration (14d)', 
                position: 'bottom', 
                fill: '#F44336',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              y={30} 
              stroke="#F44336" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'Low Threshold (30%)', 
                position: 'left', 
                fill: '#F44336',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            <ReferenceLine 
              y={70} 
              stroke="#4CAF50" 
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{ 
                value: 'High Threshold (70%)', 
                position: 'left', 
                fill: '#4CAF50',
                style: { fontFamily: 'serif', fontSize: '10px' } 
              }}
            />
            
            {/* Data points */}
            <Scatter
              data={scatterData}
              fill="#8884d8"
            />
            
            <Tooltip
              formatter={(value, name) => [name === 'approvalRate' ? `${value.toFixed(1)}%` : `${value.toFixed(1)} days`, name === 'approvalRate' ? 'Approval Rate' : 'Duration']}
              labelFormatter={(label) => `${label}`}
              contentStyle={{ fontFamily: 'serif' }}
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
                      <p>Approval Rate: {data.approvalRate.toFixed(1)}%</p>
                      <p>Voting Duration: {data.duration.toFixed(1)} days</p>
                      <p>Proposals: {data.totalProposals} total, {data.approvedProposals} approved</p>
                      <p style={{ color: data.fill }}>
                        Efficiency: {
                          data.efficiency === 'high' ? 'High' :
                          data.efficiency === 'medium' ? 'Medium' :
                          data.efficiency === 'outlier' ? 'Duration Outlier' : 'Low'
                        }
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            <Legend 
              payload={[
                { value: 'High Efficiency', type: 'square', color: '#4CAF50' },
                { value: 'Medium Efficiency', type: 'square', color: '#FFC107' },
                { value: 'Low Efficiency', type: 'square', color: '#F44336' },
                { value: 'Duration Outliers', type: 'square', color: '#9C27B0' }
              ]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Statistical Analysis:</strong></p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '300px' }}>
            <thead>
              <tr>
                <th colSpan="2" style={{ borderBottom: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
                  Approval Rate Statistics
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Minimum:</td>
                <td style={{ padding: '4px' }}>{stats.approval.min.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>1st Quartile (Q1):</td>
                <td style={{ padding: '4px' }}>{stats.approval.q1.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Median:</td>
                <td style={{ padding: '4px' }}>{stats.approval.median.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>3rd Quartile (Q3):</td>
                <td style={{ padding: '4px' }}>{stats.approval.q3.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Maximum:</td>
                <td style={{ padding: '4px' }}>{stats.approval.max.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Mean:</td>
                <td style={{ padding: '4px' }}>{stats.approval.mean.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Standard Deviation:</td>
                <td style={{ padding: '4px' }}>{stats.approval.std.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>95% Confidence Interval:</td>
                <td style={{ padding: '4px' }}>[{stats.duration.ci.lower.toFixed(1)}, {stats.duration.ci.upper.toFixed(1)}] days</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Interquartile Range (IQR):</td>
                <td style={{ padding: '4px' }}>{stats.duration.iqr.toFixed(1)} days</td>
              </tr>
              <tr>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>Statistical Outliers:</td>
                <td style={{ padding: '4px' }}>{stats.duration.outliers} DAOs</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px' }}>
          <p style={{ marginBottom: '10px' }}><strong>Efficiency Classification:</strong></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '350px' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Category</th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Count</th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '4px', fontWeight: 'bold', color: '#4CAF50' }}>High Efficiency</td>
                  <td style={{ padding: '4px' }}>{stats.efficiency.high}</td>
                  <td style={{ padding: '4px' }}>{(stats.efficiency.high / stats.totalDAOs * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px', fontWeight: 'bold', color: '#FFC107' }}>Medium Efficiency</td>
                  <td style={{ padding: '4px' }}>{stats.efficiency.medium}</td>
                  <td style={{ padding: '4px' }}>{(stats.efficiency.medium / stats.totalDAOs * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px', fontWeight: 'bold', color: '#F44336' }}>Low Efficiency</td>
                  <td style={{ padding: '4px' }}>{stats.efficiency.low}</td>
                  <td style={{ padding: '4px' }}>{(stats.efficiency.low / stats.totalDAOs * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px', fontWeight: 'bold', color: '#9C27B0' }}>Duration Outliers</td>
                  <td style={{ padding: '4px' }}>{stats.efficiency.outlier}</td>
                  <td style={{ padding: '4px' }}>{(stats.efficiency.outlier / stats.totalDAOs * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '11px', fontStyle: 'italic', lineHeight: '1.5' }}>
          <p>
            <strong>Statistical Interpretation:</strong> The box plot and distribution analysis reveal key patterns in DAO voting efficiency.
            The approval rate distribution {
              Math.abs(stats.approval.mean - stats.approval.median) < 5 ? 
                'is approximately symmetric' : 
                stats.approval.mean < stats.approval.median ? 
                  'shows negative skew (left-tailed)' : 
                  'shows positive skew (right-tailed)'
            } with a median of {stats.approval.median.toFixed(1)}%.
            {stats.approval.median > 50 ? 
              ' This indicates that the majority of DAOs successfully pass more than half of their proposals.' : 
              ' This suggests many DAOs struggle to achieve majority approval for their proposals.'
            }
          </p>
          
          <p>
            The voting duration distribution {
              Math.abs(stats.duration.mean - stats.duration.median) < 1 ? 
                'is approximately symmetric' : 
                stats.duration.mean > stats.duration.median ? 
                  'shows positive skew (right-tailed), with a few DAOs having very long voting periods' : 
                  'shows negative skew (left-tailed)'
            } with a median duration of {stats.duration.median.toFixed(1)} days.
            {stats.duration.median < 7 ? 
              ' Most DAOs have voting periods shorter than one week, promoting efficiency.' : 
              stats.duration.median > 14 ? 
                ' Many DAOs exceed the recommended maximum duration of 14 days.' : 
                ' Most DAOs maintain moderate voting periods.'
            }
          </p>
          
          <p>
            The interquartile ranges (IQR) of {stats.approval.iqr.toFixed(1)}% for approval rates and {stats.duration.iqr.toFixed(1)} days for voting durations
            indicate {
              stats.approval.iqr > 30 ? 'high variability' : 
              stats.approval.iqr > 15 ? 'moderate variability' : 'low variability'
            } in governance practices across DAOs. The 95% confidence intervals provide statistical bounds for the true population means,
            enhancing the reliability of our findings.
          </p>
          
          <p>
            <strong>Box Plot Analysis:</strong> The box plot visualization shows the five-number summary (minimum, Q1, median, Q3, maximum) 
            for both metrics, with quartile lines indicating the statistical distribution. This approach offers a more robust analysis than simple 
            averages, as it is less sensitive to outliers and better captures the actual distribution of values.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VotingEfficiencyBoxPlot;