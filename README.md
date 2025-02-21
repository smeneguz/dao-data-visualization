# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# DAO Sustainability Analysis Project

## Overview
This project provides a comprehensive analysis and visualization tool for evaluating DAO sustainability through multiple Key Performance Indicators (KPIs). It focuses on network participation, governance efficiency, and other critical metrics using real blockchain data.

## Project Structure
```
dao-analysis-project/
├── public/
│   └── data/
│       └── dao-metrics.json     # Input data file
├── src/
│   ├── components/
│   │   └── visualization/
│   │       └── KPIAnalysis/
│   │           ├── ParticipationAnalysis.jsx       # Main participation scatter plot
│   │           ├── ParticipationDistribution.jsx   # Distribution analysis
│   │           ├── ParticipationDensityAnalysis.jsx # KDE visualization
│   │           └── ThresholdAnalysis.jsx           # Threshold validation
│   ├── utils/
│   │   └── exportUtils.js      # Export utilities for figures
│   ├── lib/
│   │   └── data/
│   │       └── metrics-processor.js  # Data processing utilities
│   └── App.jsx                 # Main application component
├── package.json
└── README.md
```


## Setup and Running

1. Install dependencies:
```bash
npm install
```

2. Place your data file:
```bash
cp your-data.json public/data/dao-metrics.json
```

3. Run the development server:
```bash
npm run dev
```

## Data Requirements
Input JSON format:
```json
{
  "dao_name": "string",
  "network_participation": {
    "num_distinct_voters": number,
    "total_members": number,
    "participation_rate": number,
    "unique_proposers": number
  },
  // ... other metrics
}
```

## Visualization Export
Each visualization can be exported in:
- SVG format (vector graphics)
- High-resolution PNG (3x scale)

Usage:
```javascript
handleExport('svg' | 'png')
```


