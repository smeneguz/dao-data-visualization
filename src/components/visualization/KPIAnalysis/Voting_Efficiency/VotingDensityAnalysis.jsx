import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const VotingDensityAnalysis = () => {
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
      exportToPNG({ current: svgElement }, 'voting_density_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'voting_density_analysis');
    }
  };

  // Statistical functions
  const calculateKDE = (values, point, bandwidth) => {
    return values.reduce((sum, x) => 
      sum + Math.exp(-Math.pow(point - x, 2) / (2 * Math.pow(bandwidth, 2))) / 
      (bandwidth * Math.sqrt(2 * Math.PI)), 0) / values.length;
  };

  const calculateStatistics = (values) => {
    const n = values.length;
    const mean = _.mean(values);
    const variance = _.sumBy(values, x => Math.pow(x - mean, 2)) / (n - 1);
    const std = Math.sqrt(variance);
    const skewness = _.sum(values.map(x => Math.pow((x - mean) / std, 3))) / n;
    const kurtosis = _.sum(values.map(x => Math.pow((x - mean) / std, 4))) / n - 3;
    
    return { n, mean, std, skewness, kurtosis };
  };

  useEffect(() => {
    const analyzeDistribution = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();

        // Process approval rates
        const votingData = jsonData
          .map(dao => ({
            rate: dao.voting_efficiency.approval_rate,
            duration: dao.voting_efficiency.avg_voting_duration_days,
            proposals: dao.voting_efficiency.total_proposals,
            approved: dao.voting_efficiency.approved_proposals
          }))
          .filter(d => !isNaN(d.rate) && d.rate >= 0 && d.rate <= 100);

        const rates = votingData.map(d => d.rate);
        const baseStats = calculateStatistics(rates);

        // Calculate bandwidth using Silverman's rule
        const bandwidth = 1.06 * baseStats.std * Math.pow(baseStats.n, -0.2);

        // Create histogram with statistically sound binning
        const binWidth = 5; // 5% bins
        const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // Key percentage points
        
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r <= binEnd).length;
          const frequency = (count / baseStats.n) * 100;
          const density = calculateKDE(rates, (binStart + binEnd) / 2, bandwidth) * 100;

          return {
            binStart,
            binEnd,
            x: binStart,
            frequency,
            density,
            count,
            label: `${binStart}-${binEnd}%`
          };
        });

        // Calculate categories
        const categories = {
          low: rates.filter(r => r < 30).length,
          medium: rates.filter(r => r >= 30 && r <= 70).length,
          high: rates.filter(r => r > 70).length
        };

        setStats({
          ...baseStats,
          bandwidth,
          categories,
          percentages: {
            low: (categories.low / baseStats.n) * 100,
            medium: (categories.medium / baseStats.n) * 100,
            high: (categories.high / baseStats.n) * 100
          }
        });

        setData(histogramData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeDistribution();
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
          Figure 2: Distribution of Proposal Approval Rates
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution with kernel density estimation (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          μ = {stats.mean.toFixed(1)}%, σ = {stats.std.toFixed(1)}%
        </p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Skewness = {stats.skewness.toFixed(2)}, 
          Kurtosis = {stats.kurtosis.toFixed(2)}
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
              dataKey="binStart"
              tickFormatter={(value) => `${value}%`}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            >
              <Label
                value="Approval Rate (%)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
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

            {/* Threshold lines */}
            <ReferenceLine
              x={30}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Low Threshold (30%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              x={70}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "High Threshold (70%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Mean line */}
            <ReferenceLine
              x={stats.mean}
              stroke="#666"
              strokeDasharray="3 3"
              label={{
                value: `Mean (${stats.mean.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            <Bar
              dataKey="frequency"
              fill="#000"
              opacity={0.6}
              name="Frequency"
            />
            
            <Line
              type="monotone"
              dataKey="density"
              stroke="#ff0000"
              strokeWidth={2}
              dot={false}
              name="Density"
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
        <p style={{ marginBottom: '10px' }}><strong>Distribution Analysis:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Low Approval (&lt;30%): {stats.percentages.low.toFixed(1)}% of DAOs</li>
          <li>Medium Approval (30-70%): {stats.percentages.medium.toFixed(1)}% of DAOs</li>
          <li>High Approval (&gt;70%): {stats.percentages.high.toFixed(1)}% of DAOs</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Distribution shows {
            stats.skewness < -0.5 ? 'negative' : 
            stats.skewness > 0.5 ? 'positive' : 'minimal'
          } skewness ({stats.skewness.toFixed(2)}) and is {
            Math.abs(stats.kurtosis) < 0.5 ? 'approximately normal' :
            stats.kurtosis > 0.5 ? 'leptokurtic' : 'platykurtic'
          } (kurtosis = {stats.kurtosis.toFixed(2)}). 
          The red line represents the kernel density estimation (bandwidth = {stats.bandwidth.toFixed(3)}).
        </p>
      </div>
    </div>
  );
};

export default VotingDensityAnalysis;