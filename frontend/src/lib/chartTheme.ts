import type React from 'react';

/**
 * Recharts dark theme configuration for FedRight.
 *
 * Import and spread these props onto Recharts components.
 *
 * Usage example:
 *   import { darkChartTheme, tooltipStyle } from '@/lib/chartTheme';
 *   <CartesianGrid {...darkChartTheme.cartesianGrid} />
 *   <Tooltip contentStyle={tooltipStyle} />
 */
export const darkChartTheme = {
  // Background for the chart container (applied to ResponsiveContainer wrapper div)
  backgroundColor: 'var(--bg-secondary)',

  // CartesianGrid — the subtle grid lines in the chart background
  // Using rgba directly because Recharts `stroke` prop doesn't accept CSS var()
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: 'rgba(255, 255, 255, 0.05)',
    vertical: false, // Show only horizontal lines for cleaner look
  },

  // XAxis and YAxis shared props
  axis: {
    tick: {
      fill: '#5C6370', // --text-muted
      fontSize: 12,
      // Recharts SVG tick elements don't inherit CSS font-family; set explicitly
      fontFamily: 'var(--font-inter), sans-serif',
    },
    axisLine: {
      stroke: 'rgba(255, 255, 255, 0.06)', // --surface-border
    },
    tickLine: false, // Remove tick marks for cleaner look
  },

  // Data colors by semantic meaning
  colors: {
    primary: 'var(--brand-green)',
    secondary: 'var(--brand-amber)',
    tertiary: 'var(--color-info)',
    danger: 'var(--color-error)',
    success: 'var(--color-success)',
    muted: 'var(--text-muted)',
  },

  // Specific hex values for Recharts props that don't support CSS var()
  // (Recharts renders via SVG which has limited CSS variable support in some props)
  hexColors: {
    primary: '#1B8B4D',
    primaryLight: '#2AAF65',
    primarySubtle: 'rgba(27, 139, 77, 0.15)', // for area chart fills
    secondary: '#E6920A',
    secondarySubtle: 'rgba(230, 146, 10, 0.15)',
    tertiary: '#539BF5',
    tertiarySubtle: 'rgba(83, 155, 245, 0.15)',
    danger: '#E5534B',
    muted: '#5C6370',
    gridLine: 'rgba(255, 255, 255, 0.05)',
    axisText: '#5C6370',
  },
};

// Custom tooltip content style object
// Pass as: <Tooltip contentStyle={tooltipStyle} />
export const tooltipStyle: React.CSSProperties = {
  // CSS variables work here because Recharts renders tooltips as DOM divs, not SVG
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '12px', // --radius-md
  color: 'var(--text-primary)',
  fontSize: '12px',
  padding: '10px 14px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
  fontFamily: 'var(--font-inter), sans-serif',
};

// Tooltip label style
export const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  marginBottom: '4px',
  fontWeight: 600,
  fontFamily: 'var(--font-inter), sans-serif',
};

// Legend style
export const legendStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '12px',
  fontFamily: 'var(--font-inter), sans-serif',
};
