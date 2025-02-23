import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const VotingThreshold = () => {
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

  // Statistical functions
  const calculateKDE = (values, point, bandwidth) => {
    return values.reduce((sum, x) => 
      sum + Math.exp(-Math.pow(point - x, 2) / (2 * Math.pow(bandwidth, 2))) / 
      (bandwidth * Math.sqrt(2 * Math.PI)), 0) / values.length;
  };

  const calculateStats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const mean = _.mean(values);
    const std = Math.sqrt(_.sumBy(values, x => Math.pow(x - mean, 2)) / (n - 1));

    // Calculate quartiles and IQR
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // Calculate optimal bandwidth (Silverman's rule)
    const bandwidth = 1.06 * Math.min(std, iqr/1.34) * Math.pow(n, -0.2);

    return { mean, std, q1, q3, iqr, bandwidth };
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
          .filter(d => !isNaN(d.rate) && d.rate >= 0 && d.rate <= 100 && d.duration > 0);

        const rates = votingData.map(d => d.rate);
        const durations = votingData.map(d => d.duration);

        // Calculate statistics for both metrics
        const rateStats = calculateStats(rates);
        const durationStats = calculateStats(durations);

        // Calculate empirical thresholds
        const empiricalThresholds = {
          approval: {
            low: rateStats.q1,
            high: rateStats.q3
          },
          duration: {
            low: Math.max(2, durationStats.q1),
            high: Math.min(14, durationStats.q3)
          }
        };

        // Create density distribution
        const binWidth = 5;
        const bins = _.range(0, 105, binWidth);
        
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r < binEnd).length;
          const frequency = (count / rates.length) * 100;
          
          // Calculate kernel density
          const density = calculateKDE(rates, (binStart + binEnd) / 2, rateStats.bandwidth) * 100;

          // Calculate effectiveness scores
          const effectiveCount = votingData.filter(d => 
            d.rate >= binStart && d.rate < binEnd && 
            d.duration >= 3 && d.duration <= 14
          ).length;
          const effectiveRate = (effectiveCount / count) * 100;

          return {
            binStart,
            binEnd,
            x: binStart,
            frequency,
            density,
            effectiveRate: count > 0 ? effectiveRate : 0,
            count
          };
        });

        // Calculate category statistics
        const categorizeVote = (rate, duration) => {
          if (rate < 30 || duration < 2) return 'low';
          if (rate > 70 && duration >= 3 && duration <= 14) return 'high';
          if (duration >= 3 && duration <= 14) return 'medium';
          return 'low';
        };

        const categories = {
          current: votingData.reduce((acc, d) => {
            const cat = categorizeVote(d.rate, d.duration);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {}),
          empirical: votingData.reduce((acc, d) => {
            const cat = d.rate < empiricalThresholds.approval.low ? 'low' :
                       d.rate > empiricalThresholds.approval.high ? 'high' : 'medium';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {})
        };

        setStats({
          n: votingData.length,
          rateStats,
          durationStats,
          empiricalThresholds,
          categories,
          currentThresholds: {
            approval: { low: 30, high: 70 },
            duration: { low: 2, high: 14 }
          }
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
          Figure 3: Threshold Analysis of Voting Efficiency
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Evaluation of current and empirical thresholds (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          IQR Approval: [{stats.rateStats.q1.toFixed(1)}%, {stats.rateStats.q3.toFixed(1)}%], 
          IQR Duration: [{stats.durationStats.q1.toFixed(1)}, {stats.durationStats.q3.toFixed(1)} days]
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

            {/* Current thresholds */}
            <ReferenceLine
              yAxisId="frequency"
              x={30}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Current Low (30%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="frequency"
              x={70}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Current High (70%)",
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
                value: `Q₁ (${stats.empiricalThresholds.approval.low.toFixed(1)}%)`,
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
                value: `Q₃ (${stats.empiricalThresholds.approval.high.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

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
                      <p style={{ fontWeight: 'bold' }}>
                        {`${data.binStart}-${data.binEnd}%`}
                      </p>
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
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Current Framework (30%, 70%):
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Low Efficiency: {((stats.categories.current.low/stats.n)*100).toFixed(1)}%</li>
              <li>Medium Efficiency: {((stats.categories.current.medium/stats.n)*100).toFixed(1)}%</li>
              <li>High Efficiency: {((stats.categories.current.high/stats.n)*100).toFixed(1)}%</li>
            </ul>
          </li>
          <li>Empirical Framework (Q₁, Q₃):
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Low: {((stats.categories.empirical.low/stats.n)*100).toFixed(1)}%</li>
              <li>Medium: {((stats.categories.empirical.medium/stats.n)*100).toFixed(1)}%</li>
              <li>High: {((stats.categories.empirical.high/stats.n)*100).toFixed(1)}%</li>
            </ul>
          </li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Current thresholds (red) compared with empirical quartile-based thresholds (blue). 
          The effectiveness rate (blue line) shows the proportion of proposals within optimal 
          duration (3-14 days) for each approval rate bin. Analysis suggests {
            Math.abs(stats.empiricalThresholds.approval.low - 30) < 10 &&
            Math.abs(stats.empiricalThresholds.approval.high - 70) < 10 
              ? 'good alignment between current and empirical thresholds'
              : 'potential need for threshold adjustment'
          }.
        </p>
      </div>
    </div>
  );
};

export default VotingThreshold;