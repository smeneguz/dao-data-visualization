import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const VotingThresholdAnalysis = () => {
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
      exportToPNG({ current: svgElement }, 'voting_threshold_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'voting_threshold_analysis');
    }
  };

  // Paper-defined thresholds
  const PAPER_THRESHOLDS = {
    approval: {
      low: 30,
      high: 70
    },
    duration: {
      min: 2,
      max: 14
    }
  };

  // Statistical functions
  const calculateKDE = (values, point, bandwidth) => {
    return values.reduce((sum, x) => 
      sum + Math.exp(-Math.pow(point - x, 2) / (2 * Math.pow(bandwidth, 2))) / 
      (bandwidth * Math.sqrt(2 * Math.PI)), 0) / values.length;
  };

  const calculateStatistics = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = _.mean(values);
    const std = Math.sqrt(_.sumBy(values, x => Math.pow(x - mean, 2)) / (n - 1));

    // Calculate quantiles
    const quantiles = [0.1, 0.25, 0.5, 0.75, 0.9].map(q => {
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    });

    const [p10, q1, median, q3, p90] = quantiles;
    const iqr = q3 - q1;

    // Calculate optimal bandwidth using Silverman's rule
    const bandwidth = 1.06 * Math.min(std, iqr/1.34) * Math.pow(n, -0.2);

    // Calculate skewness and kurtosis
    const skewness = _.sum(values.map(x => Math.pow((x - mean) / std, 3))) / n;
    const kurtosis = _.sum(values.map(x => Math.pow((x - mean) / std, 4))) / n - 3;

    return { 
      n, mean, std, p10, q1, median, q3, p90, 
      iqr, bandwidth, skewness, kurtosis 
    };
  };

  const calculateEffectivenessRate = (binData, votingData, binWidth) => {
    return binData.map((bin, i) => {
      // Use sliding window of 3 bins
      const windowStart = Math.max(0, i - 1);
      const windowEnd = Math.min(binData.length, i + 2);
      const window = binData.slice(windowStart, windowEnd);
      
      const relevantData = votingData.filter(d => 
        d.rate >= bin.binStart - binWidth && 
        d.rate < bin.binEnd + binWidth
      );

      if (relevantData.length === 0) return 0;

      const effectiveCount = relevantData.filter(d => 
        d.duration >= PAPER_THRESHOLDS.duration.min && 
        d.duration <= PAPER_THRESHOLDS.duration.max
      ).length;

      // Add Bayesian smoothing
      const alpha = 1; // Prior parameter
      return (effectiveCount + alpha) / (relevantData.length + 2 * alpha) * 100;
    });
  };

  useEffect(() => {
    const analyzeThresholds = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process voting metrics
        const votingData = jsonData
          .map(dao => ({
            rate: dao.voting_efficiency.approval_rate,
            duration: dao.voting_efficiency.avg_voting_duration_days,
            proposals: dao.voting_efficiency.total_proposals,
            approved: dao.voting_efficiency.approved_proposals
          }))
          .filter(d => !isNaN(d.rate) && d.rate >= 0 && d.rate <= 100 && 
                      !isNaN(d.duration) && d.duration > 0);

        const rates = votingData.map(d => d.rate);
        const durations = votingData.map(d => d.duration);

        // Calculate statistics
        const rateStats = calculateStatistics(rates);
        const durationStats = calculateStatistics(durations);

        // Calculate empirical thresholds
        const empiricalThresholds = {
          approval: {
            low: rateStats.q1,    // Use Q1 as lower threshold
            medium: rateStats.median,  // Median as middle point
            high: rateStats.q3     // Use Q3 as upper threshold
          },
          duration: {
            min: Math.max(2, durationStats.q1),  // Ensure minimum of 2 days
            optimal: durationStats.median,
            max: Math.min(14, durationStats.q3)  // Cap at 14 days
          }
        };

        // Create histogram data
        const binWidth = 5;  // 5% bins
        const bins = _.range(0, 105, binWidth);
        
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r < binEnd).length;
          const frequency = (count / rates.length) * 100;
          
          // Calculate density
          const density = calculateKDE(rates, (binStart + binEnd) / 2, rateStats.bandwidth) * 100;

          return {
            binStart,
            binEnd,
            x: binStart,
            frequency,
            density,
            count
          };
        });

        // Calculate effectiveness rates with smoothing
        const effectivenessRates = calculateEffectivenessRate(histogramData, votingData, binWidth);
        histogramData.forEach((bin, i) => {
          bin.effectiveRate = effectivenessRates[i];
        });

        // Calculate categories using both threshold sets
        const categorizeProposal = (rate, duration, thresholds) => {
          if (rate < thresholds.approval.low || duration < PAPER_THRESHOLDS.duration.min) 
            return 'low';
          if (rate > thresholds.approval.high && 
              duration >= PAPER_THRESHOLDS.duration.min && 
              duration <= PAPER_THRESHOLDS.duration.max) 
            return 'high';
          if (duration >= PAPER_THRESHOLDS.duration.min && 
              duration <= PAPER_THRESHOLDS.duration.max) 
            return 'medium';
          return 'low';
        };

        const categories = {
          paper: votingData.reduce((acc, d) => {
            const cat = categorizeProposal(d.rate, d.duration, PAPER_THRESHOLDS);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {}),
          empirical: votingData.reduce((acc, d) => {
            const cat = categorizeProposal(d.rate, d.duration, empiricalThresholds);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {})
        };

        setStats({
          n: votingData.length,
          rateStats,
          durationStats,
          empiricalThresholds,
          paperThresholds: PAPER_THRESHOLDS,
          categories
        });

        setData(histogramData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeThresholds();
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
          Figure 3: Voting Efficiency Threshold Analysis
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Comparison of theoretical and empirical thresholds (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          IQR Approval: [{stats.rateStats.q1.toFixed(1)}%, {stats.rateStats.q3.toFixed(1)}%], 
          Duration: [{stats.durationStats.q1.toFixed(1)}, {stats.durationStats.q3.toFixed(1)} days]
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 50, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="x"
              tickFormatter={(value) => `${value}%`}
            >
              <Label
                value="Approval Rate (%)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              yAxisId="frequency"
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            >
              <Label
                value="Relative Frequency (%)"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>
            <YAxis
              yAxisId="effectiveness"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            >
              <Label
                value="Effectiveness Rate (%)"
                angle={90}
                position="right"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Paper thresholds */}
            <ReferenceLine
              yAxisId="frequency"
              x={PAPER_THRESHOLDS.approval.low}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Paper Low (30%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="frequency"
              x={PAPER_THRESHOLDS.approval.high}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Paper High (70%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Empirical thresholds */}
            <ReferenceLine
              yAxisId="frequency"
              x={stats.empiricalThresholds.approval.low}
              stroke="#0066cc"
              strokeDasharray="3 3"
              label={{
                value: `Empirical Q₁ (${stats.empiricalThresholds.approval.low.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="frequency"
              x={stats.empiricalThresholds.approval.high}
              stroke="#0066cc"
              strokeDasharray="3 3"
              label={{
                value: `Empirical Q₃ (${stats.empiricalThresholds.approval.high.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Distribution components */}
            <Bar
              yAxisId="frequency"
              dataKey="frequency"
              fill="#000"
              opacity={0.6}
              name="Frequency"
            />
            
            <Line
              yAxisId="frequency"
              type="monotone"
              dataKey="density"
              stroke="#ff0000"
              strokeWidth={2}
              dot={false}
              name="Density"
            />

            <Line
              yAxisId="effectiveness"
              type="monotone"
              dataKey="effectiveRate"
              stroke="#0066cc"
              strokeWidth={2}
              dot={false}
              name="Effectiveness"
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
                      <p style={{ fontWeight: 'bold' }}>{`${data.binStart}-${data.binEnd}%`}</p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count} DAOs</p>
                      <p>Effectiveness: {data.effectiveRate.toFixed(1)}%</p>
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
        <p style={{ marginBottom: '10px' }}><strong>Threshold Analysis:</strong></p>
        <p style={{ marginBottom: '5px' }}>Paper-defined Framework (30%, 70%):</p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginBottom: '10px' }}>
          <li>Low Efficiency: {((stats.categories.paper.low/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Approval &lt; 30% or duration &lt; 2 days</li>
            </ul>
          </li>
          <li>Medium Efficiency: {((stats.categories.paper.medium/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>30% ≤ Approval ≤ 70% and 2-14 days duration</li>
            </ul>
          </li>
          <li>High Efficiency: {((stats.categories.paper.high/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Approval &gt; 70% and 2-14 days duration</li>
            </ul>
          </li>
        </ul>
        
        <p style={{ marginBottom: '5px' }}>Empirical Framework (Q₁: {stats.empiricalThresholds.approval.low.toFixed(1)}%, Q₃: {stats.empiricalThresholds.approval.high.toFixed(1)}%):</p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginBottom: '10px' }}>
          <li>Low: {((stats.categories.empirical.low/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Below Q₁ or duration thresholds</li>
            </ul>
          </li>
          <li>Medium: {((stats.categories.empirical.medium/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Between Q₁ and Q₃ with optimal duration</li>
            </ul>
          </li>
          <li>High: {((stats.categories.empirical.high/stats.n)*100).toFixed(1)}%
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Above Q₃ with optimal duration</li>
            </ul>
          </li>
        </ul>

        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: The red lines show paper-defined thresholds (30% and 70%), while blue lines represent empirically derived thresholds 
          based on the data distribution (Q₁ and Q₃). The black bars show frequency distribution, red line shows kernel density 
          estimation, and blue line represents the smoothed effectiveness rate (proportion of proposals within optimal duration 
          {stats.durationStats.q1.toFixed(1)}-{stats.durationStats.q3.toFixed(1)} days). 
          Analysis {
            Math.abs(stats.empiricalThresholds.approval.low - PAPER_THRESHOLDS.approval.low) < 10 &&
            Math.abs(stats.empiricalThresholds.approval.high - PAPER_THRESHOLDS.approval.high) < 10 
              ? 'supports the current threshold values'
              : 'suggests potential refinement of thresholds'
          } based on observed voting patterns 
          (skewness = {stats.rateStats.skewness.toFixed(2)}, 
          kurtosis = {stats.rateStats.kurtosis.toFixed(2)}).
        </p>
      </div>
    </div>
  );
};

export default VotingThresholdAnalysis;