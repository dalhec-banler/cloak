/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d0d1a',
        surface: '#1a1a2e',
        border: '#2a2a3e',
        ink: '#e0e0e0',
        muted: '#888888',
        faint: '#555555',
        accent: '#6c5ce7',
        'accent-soft': '#2a2540',
        danger: '#e74c3c',
        'danger-soft': '#3a1a1a',
        success: '#2ecc71',
        'success-soft': '#1a3a2a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
