import StyleDictionary from 'style-dictionary';

// Uma fonte (tokens.json) -> vários formatos. Nunca dessincroniza.
//
// buildPath aponta para '.' (e não 'build/', como no repo original do @mg) —
// adaptação da cópia vendorizada: o alias do Vite/tsc ("@mg/tokens/tokens.css")
// aponta direto para este diretório, então o build sobrescreve os arquivos
// aqui mesmo em vez de gerar uma subpasta build/ que ninguém referenciaria.
const sd = new StyleDictionary({
  source: ['tokens.json'],
  platforms: {
    // 1) CSS custom properties -> consumido por CSS puro / CSS Modules
    css: {
      transformGroup: 'css',
      prefix: 'mg',
      buildPath: './',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true }
        }
      ]
    },
    // 2) Objeto JS/TS -> consumido por Vanilla Extract, JS, etc.
    js: {
      transformGroup: 'js',
      prefix: 'mg',
      buildPath: './',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6'
        }
      ]
    }
  }
});

await sd.buildAllPlatforms();
console.log('tokens.css e tokens.js regenerados em packages/@mg-tokens/');
