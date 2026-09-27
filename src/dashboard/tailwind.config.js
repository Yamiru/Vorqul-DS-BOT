const path = require('path');

const palette = {
  dark: '#1B1815', darker: '#14120F', light: '#2C271F', lighter: '#3A332A',
  blurple: '#14707A', green: '#7FA05B', yellow: '#E3C766', red: '#D06450',
  fuchsia: '#B0567E', white: '#EDE6D8', text: '#EDE6D8', muted: '#948C7C',
};

const sumi = {
  sumi: '#14120F', kachi: '#1B1815', roiro: '#221E19', keshi: '#2C271F',
  susu: '#3A332A', nezumi: '#948C7C', shironezumi: '#B9B0A0', gofun: '#EDE6D8',
  asagi: '#14707A', 'asagi-hi': '#1A8C99', shu: '#E2571E', kogane: '#D9A441',
  matsuba: '#6E8F4E', bengara: '#D06450',
};

module.exports = {
  darkMode: 'class',

  content: [
    path.join(__dirname, 'app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'components/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  safelist: [
    { pattern: /^(bg|text|border|hover:bg|hover:text|focus:border|placeholder)-discord-(dark|darker|light|lighter|blurple|green|yellow|red|fuchsia|white|text|muted)$/ },
    'bg-opacity-80', 'hover:bg-opacity-80', 'focus:outline-none',
  ],
  theme: {
    extend: {
      colors: { discord: palette, sumi },
      fontFamily: {
        sans: ['Noto Sans', 'system-ui', 'sans-serif'],
        display: ['Noto Serif JP', 'Noto Serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
