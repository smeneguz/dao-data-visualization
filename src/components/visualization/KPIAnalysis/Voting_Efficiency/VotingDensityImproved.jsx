import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, Area } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const VotingDensityImproved = () => {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);

  // Enhanced statistical functions
  const calculateKDE = (values, point, bandwidth) => {
    return values.reduce((sum, x) => 
      sum + Math.exp(-Math.pow(point - x, 2) / (2 * Math.pow(bandwidth, 2))) / 
      (bandwidth * Math.sqrt(2 * Math.PI)), 0) / values.length;
  };

  const calculateConfidenceInterval = (mean, std, n, confidence = 0.95) => {
    const z = 1.96; // 95% confidence level
    const margin = z * (std / Math.sqrt(n));
    return {
      lower: mean - margin,
      upper: mean + margin
    };
  };

  const calculateCategoryStats = (values, thresholds) => {
    const categories = {
      low: values.filter(v => v < thresholds.low),
      medium: values.filter(v => v >= thresholds.low && v <= thresholds.high),
      high: values.filter(v => v > thresholds.high)
    };

    return {
      low: {
        count: categories.low.length,
        mean: _.mean(categories.low),
        median: _.sortBy(categories.low)[Math.floor(categories.low.length/2)]
      },
      medium: {
        count: categories.medium.length,
        mean: _.mean(categories.medium),
        median: _.sortBy(categories.medium)[Math.floor(categories.medium.length/2)]
      },
      high: {
        count: categories.high.length,
        mean: _.mean(categories.high),
        median: _.sortBy(categories.high)[Math.floor(categories.high.length/2)]
      }
    };
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
        
        // Calculate basic statistics
        const mean = _.mean(rates);
        const std = Math.sqrt(_.sumBy(rates, r => Math.pow(r - mean, 2)) / (rates.length - 1));
        const skewness = _.sum(rates.map(x => Math.pow((x - mean) / std, 3))) / rates.length;
        const kurtosis = _.sum(rates.map(x => Math.pow((x - mean) / std, 4))) / rates.length - 3;
        
        // Calculate confidence intervals
        const ci = calculateConfidenceInterval(mean, std, rates.length);
        
        // Calculate category-specific statistics
        const categoryStats = calculateCategoryStats(rates, { low: 30, high: 70 });

        // Create histogram with enhanced binning
        const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        const bandwidth = 1.06 * std * Math.pow(rates.length, -0.2); // Silverman's rule

        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r < binEnd).length;
          const frequency = (count / rates.length) * 100;
          const density = calculateKDE(rates, (binStart + binEnd) / 2, bandwidth) * 100;
          
          // Calculate cumulative frequency
          const cumulative = (rates.filter(r => r < binEnd).length / rates.length) * 100;

          return {
            binStart,
            binEnd,
            x: binStart,
            frequency,
            density,
            cumulative,
            count,
            label: `${binStart}-${binEnd}%`
          };
        });

        setStats({
          n: rates.length,
          mean,
          std,
          skewness,
          kurtosis,
          ci,
          bandwidth,
          categoryStats,
          percentages: {
            low: (categoryStats.low.count / rates.length) * 100,
            medium: (categoryStats.medium.count / rates.length) * 100,
            high: (categoryStats.high.count / rates.length) * 100
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
          Figure 2.1: Distribution of Proposal Approval Rates
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution with kernel density estimation (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          μ = {stats.mean.toFixed(1)}% (95% CI: [{stats.ci.lower.toFixed(1)}, {stats.ci.upper.toFixed(1)}]), 
          σ = {stats.std.toFixed(1)}%
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
              dataKey="x"
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
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
              yAxisId="cumulative"
              orientation="right"
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            >
              <Label
                value="Cumulative Frequency (%)"
                angle={90}
                position="right"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Category zones */}
            <Area
              yAxisId="frequency"
              x1={30} x2={70}
              fill="#FFF3E0"
              fillOpacity={0.1}
            />

            {/* Threshold lines */}
            <ReferenceLine
              yAxisId="frequency"
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
              yAxisId="frequency"
              x={70}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "High Threshold (70%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Mean and CI */}
            <ReferenceLine
              yAxisId="frequency"
              x={stats.mean}
              stroke="#666"
              strokeDasharray="3 3"
              label={{
                value: `Mean (${stats.mean.toFixed(1)}%)`,
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
              yAxisId="cumulative"
              type="monotone"
              dataKey="cumulative"
              stroke="#0066cc"
              strokeWidth={1}
              dot={false}
              name="Cumulative"
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
                      <p style={{ fontWeight: 'bold' }}>{data.label}</p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count} DAOs</p>
                      <p>Density: {data.density.toFixed(2)}</p>
                      <p>Cumulative: {data.cumulative.toFixed(1)}%</p>
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
          <li>Low Approval (&lt;30%): {stats.percentages.low.toFixed(1)}% of DAOs
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Mean: {stats.categoryStats.low.mean.toFixed(1)}%</li>
              <li>Median: {stats.categoryStats.low.median.toFixed(1)}%</li>
            </ul>
          </li>
          <li>Medium Approval (30-70%): {stats.percentages.medium.toFixed(1)}% of DAOs
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Mean: {stats.categoryStats.medium.mean.toFixed(1)}%</li>
              <li>Median: {stats.categoryStats.medium.median.toFixed(1)}%</li>
            </ul>
          </li>
          <li>High Approval (&gt;70%): {stats.percentages.high.toFixed(1)}% of DAOs
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>Mean: {stats.categoryStats.high.mean.toFixed(1)}%</li>
              <li>Median: {stats.categoryStats.high.median.toFixed(1)}%</li>
            </ul>
          </li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Distribution shows {
            stats.skewness < -0.5 ? 'negative' : 
            stats.skewness > 0.5 ? 'positive' : 'minimal'
          } skewness ({stats.skewness.toFixed(2)}) and is {
            Math.abs(stats.kurtosis) < 0.5 ? 'approximately normal' :
            stats.kurtosis > 0.5 ? 'leptokurtic' : 'platykurtic'
          } (kurtosis = {stats.kurtosis.toFixed(2)}). 
          The red line represents the kernel density estimation (bandwidth = {stats.bandwidth.toFixed(3)}), 
          and the blue line shows the cumulative distribution. Category-specific statistics 
          indicate {
            stats.percentages.high > stats.percentages.low ? 'a tendency toward high' : 
            stats.percentages.low > stats.percentages.high ? 'a tendency toward low' : 'balanced'
          } approval rates.
        </p>
      </div>
    </div>
  );
};

export default VotingDensityImproved;