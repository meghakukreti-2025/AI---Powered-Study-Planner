import os

os.makedirs('assets', exist_ok=True)

# 1. STANDALONE C ICON (assets/cognify-icon.svg)
# Features:
# - Rich 3D gradient curved letter C (Violet #8B5CF6 -> Indigo #6366F1 -> Electric Blue #3B82F6 -> Cyan #22D3EE)
# - Integrated open book symbol inside the lower curvature
# - AI Neural network node cluster branching from upper right tip
# - Subtle glow filter
icon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="cogCMain" x1="15%" y1="5%" x2="85%" y2="95%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="35%" stop-color="#6366F1" />
      <stop offset="70%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#22D3EE" />
    </linearGradient>
    <linearGradient id="cogCShade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#1E1B4B" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="cogBookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#E2E8F0" stop-opacity="0.85" />
    </linearGradient>
    <filter id="cogDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#6366F1" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Main C Shape with 3D Ribbon Sweep -->
  <g filter="url(#cogDropShadow)">
    <!-- Base Outer Contour -->
    <path d="M 85 30 C 74 16 58 10 42 13 C 20 17 6 36 6 59 C 6 83 23 103 48 105 C 68 107 84 96 92 80 C 93.5 77 91.5 73.5 88 73.5 C 85 73.5 82.5 75.5 81 78 C 75 88 63 94 48 93 C 30 92 18 77 18 59 C 18 41 29 26 46 23 C 58 21 71 26 79 36 C 80.5 38 83.5 38.5 86 37 C 88.5 35.5 89 32.5 85 30 Z" fill="url(#cogCMain)" />

    <!-- Overlapping Inner Shadow / Dimensional Ribbon Fold -->
    <path d="M 46 23 C 29 26 18 41 18 59 C 18 77 30 92 48 93 C 34 88 25 75 25 60 C 25 44 34 30 48 24 Z" fill="url(#cogCShade)" />
  </g>

  <!-- Open Book Symbol nestled inside the C -->
  <g transform="translate(45, 62) scale(0.72)">
    <!-- Left Page -->
    <path d="M -3 3 C -13 -4 -26 -3 -35 2 L -35 26 C -26 21 -13 20 -3 27 Z" fill="url(#cogBookGrad)" />
    <!-- Right Page -->
    <path d="M 3 3 C 13 -4 26 -3 35 2 L 35 26 C 26 21 13 20 3 27 Z" fill="url(#cogBookGrad)" />
    <!-- Book Center Fold / Spine -->
    <path d="M 0 2 L 0 28" stroke="#4F46E5" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- AI Neural Network Node Cluster on upper-right -->
  <g transform="translate(72, 18)">
    <!-- Circuit Connectors -->
    <path d="M 8 18 L 22 10 M 22 10 L 34 2 M 22 10 L 35 20" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Central Hub Node -->
    <circle cx="22" cy="10" r="4.5" fill="#38BDF8" />
    <circle cx="22" cy="10" r="2" fill="#FFFFFF" />

    <!-- Top Node -->
    <circle cx="34" cy="2" r="3.5" fill="#818CF8" />
    <circle cx="34" cy="2" r="1.5" fill="#FFFFFF" />

    <!-- Lower Node -->
    <circle cx="35" cy="20" r="4" fill="#22D3EE" />
    <circle cx="35" cy="20" r="1.8" fill="#FFFFFF" />
  </g>
</svg>'''

with open('assets/cognify-icon.svg', 'w', encoding='utf-8') as f:
    f.write(icon_svg)

# 2. HORIZONTAL LOGO DARK (assets/cognify-logo-dark.svg)
logo_dark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 76" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="cogTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#A78BFA" />
      <stop offset="45%" stop-color="#818CF8" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>
  </defs>

  <!-- Embedded Icon at 70x70 scale -->
  <g transform="translate(2, -2) scale(0.66)">
''' + icon_svg.split('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" fill="none">')[1].rsplit('</svg>', 1)[0] + '''
  </g>

  <!-- Wordmark "Cognify" -->
  <text x="88" y="44" font-family="'Inter', -apple-system, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.03em" fill="url(#cogTextGrad)">Cognify</text>

  <!-- Subtitle -->
  <text x="90" y="62" font-family="'Inter', -apple-system, sans-serif" font-size="9" font-weight="700" letter-spacing="0.12em" fill="#94A3B8">SMART STUDY HUB &amp; AI SCHEDULE GENERATOR</text>
</svg>'''

with open('assets/cognify-logo-dark.svg', 'w', encoding='utf-8') as f:
    f.write(logo_dark_svg)

# 3. HORIZONTAL LOGO LIGHT (assets/cognify-logo-light.svg)
logo_light_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 76" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="cogTextGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6D28D9" />
      <stop offset="45%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
  </defs>

  <!-- Embedded Icon at 70x70 scale -->
  <g transform="translate(2, -2) scale(0.66)">
''' + icon_svg.split('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" fill="none">')[1].rsplit('</svg>', 1)[0] + '''
  </g>

  <!-- Wordmark "Cognify" -->
  <text x="88" y="44" font-family="'Inter', -apple-system, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.03em" fill="url(#cogTextGradLight)">Cognify</text>

  <!-- Subtitle -->
  <text x="90" y="62" font-family="'Inter', -apple-system, sans-serif" font-size="9" font-weight="700" letter-spacing="0.12em" fill="#64748B">SMART STUDY HUB &amp; AI SCHEDULE GENERATOR</text>
</svg>'''

with open('assets/cognify-logo-light.svg', 'w', encoding='utf-8') as f:
    f.write(logo_light_svg)

# 4. FAVICON (assets/favicon.svg)
# High-contrast, bold geometry optimized for 16x16 and 32x32 tab rendering
favicon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <defs>
    <linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>
  </defs>

  <!-- Background tile for crisp contrast in browser tab -->
  <rect width="32" height="32" rx="7" fill="#0F172A" />

  <!-- Bold C Shape -->
  <path d="M 23 8.5 C 20.5 5.5 16.5 4.5 12.5 5.5 C 7.5 6.8 4 11.2 4 16.5 C 4 22 8 26.5 13.5 27 C 18 27.5 21.5 25.5 23.5 22 C 24 21 23 20 22 20 C 21 20 20.5 20.5 20 21.2 C 18.5 23.5 15.8 24.5 13 24.2 C 9.5 23.8 6.8 20.5 6.8 16.5 C 6.8 12.5 9.2 9 13 8.2 C 15.8 7.8 18.5 8.5 20.5 10.5 C 21.2 11.2 22.5 11 23 10 C 23.5 9.5 23.5 9 23 8.5 Z" fill="url(#favGrad)" />

  <!-- Mini Book inside -->
  <path d="M 11 18 C 12.5 17 14 17 15 18 L 15 22 C 14 21.5 12.5 21.5 11 22 Z" fill="#FFFFFF" opacity="0.9" />
  <path d="M 17 18 C 18.5 17 20 17 21 18 L 21 22 C 20 21.5 18.5 21.5 17 22 Z" fill="#FFFFFF" opacity="0.9" />

  <!-- Mini AI Node -->
  <circle cx="24.5" cy="7.5" r="2" fill="#38BDF8" />
  <circle cx="24.5" cy="7.5" r="0.8" fill="#FFFFFF" />
</svg>'''

with open('assets/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(favicon_svg)

print('Generated all logo and favicon assets successfully!')
