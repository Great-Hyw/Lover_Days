/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        display: [
          'Cormorant Garamond',
          'Georgia',
          'Times New Roman',
          'Songti SC',
          'STSong',
          'SimSun',
          'serif'
        ],
        sans: [
          'Outfit',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -36px, 0) scale(1.08)' }
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' }
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'float-slower': 'float-slow 13s ease-in-out infinite',
        marquee: 'marquee 22s linear infinite',
        'spin-slow': 'spin-slow 24s linear infinite'
      }
    }
  },
  plugins: []
}
