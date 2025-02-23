import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, ReferenceArea } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const VotingEfficiencyImproved = () => {
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
      exportToPNG({ current: svgElement }, 'voting_efficiency_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'voting_efficiency_analysis');
    }
  };

  // Calculate confidence interval
  const calculateCI = (values, mean, std, n) => {
    const z = 1.96; // 95% confidence level
    const se = std / Math.sqrt(n);
    return {
      lower: mean - z * se,
      upper: mean + z * se
    };
  };

  // Calculate correlation coefficient
  const calculateCorrelation = (x, y) => {
    const xMean = _.mean(x);
    const yMean = _.mean(y);
    const numerator = _.sum(_.zipWith(x, y, (xi, yi) => (xi - xMean) * (yi - yMean)));
    const denominator = Math.sqrt(
      _.sum(x.map(xi => Math.pow(xi - xMean, 2))) *
      _.sum(y.map(yi => Math.pow(yi - yMean, 2)))
    );
    return numerator / denominator;
  };

  useEffect(() => {
    const analyzeVotingEfficiency = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process voting metrics
        const votingData = jsonData
          .map(dao => ({
            name: dao.dao_name,
            approvalRate: dao.voting_efficiency.approval_rate,
            duration: dao.voting_efficiency.avg_voting_duration_days,
            totalProposals: dao.voting_efficiency.total_proposals,
            approvedProposals: dao.voting_efficiency.approved_proposals,
            size: Math.sqrt(dao.voting_efficiency.total_proposals) * 3 // Scale factor for visual
          }))
          .filter(d => !isNaN(d.approvalRate) && !isNaN(d.duration) && 
                      d.approvalRate >= 0 && d.approvalRate <= 100 &&
                      d.duration > 0);

        // Calculate statistics
        const approvalRates = votingData.map(d => d.approvalRate);
        const durations = votingData.map(d => d.duration);

        const approvalMean = _.mean(approvalRates);
        const durationMean = _.mean(durations);
        const approvalStd = Math.sqrt(_.sumBy(approvalRates, r => Math.pow(r - approvalMean, 2)) / (approvalRates.length - 1));
        const durationStd = Math.sqrt(_.sumBy(durations, d => Math.pow(d - durationMean, 2)) / (durations.length - 1));

        // Calculate confidence intervals
        const approvalCI = calculateCI(approvalRates, approvalMean, approvalStd, approvalRates.length);
        const durationCI = calculateCI(durations, durationMean, durationStd, durations.length);

        // Calculate correlation
        const correlation = calculateCorrelation(approvalRates, durations);

        const stats = {
          n: votingData.length,
          approval: {
            mean: approvalMean,
            median: _.sortBy(approvalRates)[Math.floor(approvalRates.length/2)],
            std: approvalStd,
            ci: approvalCI
          },
          duration: {
            mean: durationMean,
            median: _.sortBy(durations)[Math.floor(durations.length/2)],
            std: durationStd,
            ci: durationCI
          },
          correlation,
          categories: {
            low: votingData.filter(d => d.approvalRate < 30 || d.duration < 2).length,
            medium: votingData.filter(d => d.approvalRate >= 30 && d.approvalRate <= 70 && 
                                        d.duration >= 3 && d.duration <= 14).length,
            high: votingData.filter(d => d.approvalRate > 70 && 
                                     d.duration >= 3 && d.duration <= 14).length,
            outliers: votingData.filter(d => d.duration > 14).length
          }
        };

        setStats(stats);
        setData(votingData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeVotingEfficiency();
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
          Figure 2: Voting Efficiency Analysis (Improved)
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution of approval rates and voting durations (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Mean approval: {stats.approval.mean.toFixed(1)}% (σ = {stats.approval.std.toFixed(1)}%, CI: [{stats.approval.ci.lower.toFixed(1)}, {stats.approval.ci.upper.toFixed(1)}]),<br/>
          Mean duration: {stats.duration.mean.toFixed(1)} days (σ = {stats.duration.std.toFixed(1)}, CI: [{stats.duration.ci.lower.toFixed(1)}, {stats.duration.ci.upper.toFixed(1)}])
        </p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Correlation coefficient (r) = {stats.correlation.toFixed(2)}
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ScatterChart
            margin={{ top: 20, right: 50, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="duration"
              type="number"
              name="Duration"
              domain={[0, 'auto']}
              tickFormatter={(value) => `${value.toFixed(0)}d`}
            >
              <Label
                value="Average Voting Duration (days)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              dataKey="approvalRate"
              type="number"
              name="Approval Rate"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            >
              <Label
                value="Proposal Approval Rate (%)"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Category zones */}
            <ReferenceArea
              x1={3} x2={14}
              y1={70} y2={100}
              fill="#90EE90"
              fillOpacity={0.1}
              stroke="none"
            />
            <ReferenceArea
              x1={3} x2={14}
              y1={30} y2={70}
              fill="#FFE5B4"
              fillOpacity={0.1}
              stroke="none"
            />

            {/* Threshold lines */}
            <ReferenceLine
              y={30}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Low Threshold (30%)",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              y={70}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "High Threshold (70%)",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              x={2}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "Min Duration (2d)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              x={14}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "Max Duration (14d)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Mean lines */}
            <ReferenceLine
              y={stats.approval.mean}
              stroke="#666"
              strokeDasharray="2 2"
              label={{
                value: `Mean (${stats.approval.mean.toFixed(1)}%)`,
                position: "left",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#666' }
              }}
            />
            <ReferenceLine
              x={stats.duration.mean}
              stroke="#666"
              strokeDasharray="2 2"
              label={{
                value: `Mean (${stats.duration.mean.toFixed(1)}d)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#666' }
              }}
            />

            <Scatter
              data={data}
              fill="#000"
              opacity={0.6}
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
                      <p style={{ fontWeight: 'bold' }}>{data.name}</p>
                      <p>Approval Rate: {data.approvalRate.toFixed(1)}%</p>
                      <p>Avg. Duration: {data.duration.toFixed(1)} days</p>
                      <p>Total Proposals: {data.totalProposals}</p>
                      <p>Approved: {data.approvedProposals}</p>
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
        <p style={{ marginBottom: '10px' }}><strong>Efficiency Classification:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Low Efficiency: {((stats.categories.low/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>Medium Efficiency: {((stats.categories.medium/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>High Efficiency: {((stats.categories.high/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>Duration Outliers: {((stats.categories.outliers/stats.n)*100).toFixed(1)}% of DAOs</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Low efficiency is defined by either approval rate &lt;30% or voting duration &lt;2 days.
          High efficiency (green zone) requires both approval rate &gt;70% and duration between 3-14 days.
          Medium efficiency (orange zone) covers the remaining cases within the duration bounds.
          Correlation coefficient (r = {stats.correlation.toFixed(2)}) indicates {
            Math.abs(stats.correlation) < 0.3 ? 'weak' : 
            Math.abs(stats.correlation) < 0.7 ? 'moderate' : 'strong'
          } relationship between metrics.
        </p>
      </div>
    </div>
  );
};

export default VotingEfficiencyImproved;